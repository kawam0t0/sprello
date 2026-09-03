import { NextRequest, NextResponse } from "next/server"
import { KOGATA_12H } from "@/lib/census-kogata"

// 道路交通センサス（令和3年度 一般交通量調査）の「昼間12時間交通量」を
// 候補地の緯度経度から最寄り調査区間で取得する。
// 国交省の可視化ツールが配信している公開GeoJSONタイル（z=13/道路種別別レイヤ）を
// サーバー側で直接読み、最寄り区間を特定する。
// 既定は「小型車（上下合計）」の昼間12時間交通量を返す（可視化ツールの小型車と一致）。
// 小型車は箇所別基本表(kasyoNN.csv)由来の対応表 KOGATA_12H を区間番号で引く。
// 対応県が無い区間はタイルの 12H_trf（全車上下計）にフォールバック。
// APIキー・DB取込は不要。値は令和3年度センサスの実測/推計値。

const BASE = "https://www.mlit.go.jp/road/ir/ir-data/census_visualizationR3"
const Z = 13
// 一般道の道路種別レイヤ（高速drm10・都市高速drm20は洗車場と無関係なので除外）
const LAYERS = ["drm31", "drm32", "drm40_50", "drm60_70"] as const

const LAYER_LABEL: Record<string, string> = {
  drm31: "一般国道(直轄)",
  drm32: "一般国道(その他)",
  drm40_50: "国道・主要地方道",
  drm60_70: "都道府県道",
}

function tileXY(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return { x, y }
}

// 点(P)から線分(A-B)への最短距離(m)。局所的な正距円筒近似。
function segDistM(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const k = Math.cos((pLat * Math.PI) / 180) * 111320
  const M = 111320
  const ax = (aLon - pLon) * k,
    ay = (aLat - pLat) * M
  const bx = (bLon - pLon) * k,
    by = (bLat - pLat) * M
  const dx = bx - ax,
    dy = by - ay
  const L2 = dx * dx + dy * dy
  let t = L2 ? ((-ax) * dx + (-ay) * dy) / L2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx,
    cy = ay + t * dy
  return Math.hypot(cx, cy)
}

function minDistToGeom(pLat: number, pLon: number, geom: any): number {
  if (!geom) return Infinity
  const lines: number[][][] =
    geom.type === "LineString" ? [geom.coordinates] : geom.type === "MultiLineString" ? geom.coordinates : []
  let m = Infinity
  for (const ln of lines) {
    for (let i = 0; i + 1 < ln.length; i++) {
      const a = ln[i],
        b = ln[i + 1]
      const d = segDistM(pLat, pLon, a[1], a[0], b[1], b[0])
      if (d < m) m = d
    }
  }
  return m
}

async function fetchTile(layer: string, x: number, y: number): Promise<any[] | null> {
  try {
    const res = await fetch(`${BASE}/${layer}/${Z}/${x}/${y}.geojson`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null // タイル無し(404)は通常
    const j = await res.json()
    return Array.isArray(j?.features) ? j.features : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 })
  }

  const c = tileXY(lat, lng, Z)
  // 3x3 近傍タイル × 各道路種別レイヤを並列取得
  const jobs: Promise<{ layer: string; features: any[] | null }>[] = []
  for (const layer of LAYERS) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        jobs.push(
          fetchTile(layer, c.x + dx, c.y + dy).then((features) => ({ layer, features })),
        )
      }
    }
  }
  const results = await Promise.all(jobs)

  // 候補区間を全部集める（distance と 12H_trf 全車）
  type Cand = {
    d: number
    traffic: number
    layer: string
    census: string
    lanes: number | null
    props: Record<string, any>
  }
  const cands: Cand[] = []
  for (const { layer, features } of results) {
    if (!features) continue
    for (const f of features) {
      const t = Number(f?.properties?.["12H_trf"])
      if (!Number.isFinite(t)) continue
      const d = minDistToGeom(lat, lng, f.geometry)
      cands.push({
        d,
        traffic: t,
        layer,
        census: String(f?.properties?.census ?? ""),
        lanes: Number.isFinite(Number(f?.properties?.Linenum)) ? Number(f.properties.Linenum) : null,
        props: f?.properties ?? {},
      })
    }
  }
  cands.sort((a, b) => a.d - b.d)

  const MAX_DIST = 2000
  // 主要道優先: 近傍(NEAR以内)で最も交通量が多い区間を選ぶ。
  // 近傍に無ければ最寄り区間にフォールバック（MAX_DIST以内）。
  const NEAR = 350
  const near = cands.filter((c) => c.d <= NEAR)
  let best: Cand | null = null
  if (near.length > 0) {
    best = near.reduce((mx, c) => (c.traffic > mx.traffic ? c : mx), near[0])
  } else {
    best = cands.find((c) => c.d <= MAX_DIST) ?? null
  }

  // デバッグ: 近傍候補の一覧を返す（区間選択の調整用。?debug=1）
  if (searchParams.get("debug") === "1") {
    return NextResponse.json({
      chosen: best
        ? { census: best.census, distance_m: Math.round(best.d), all_12h: best.traffic, kogata: KOGATA_12H[best.census] ?? null }
        : null,
      candidates: cands.slice(0, 12).map((c) => ({
        census: c.census,
        distance_m: Math.round(c.d),
        all_12h: c.traffic,
        kogata: KOGATA_12H[c.census] ?? null,
      })),
    })
  }

  if (!best) {
    return NextResponse.json({
      found: false,
      message: "近くに交通量調査区間が見つかりませんでした（半径約2km内）。手入力してください。",
    })
  }

  // 小型車の上り/下り（片側）。対応表に無ければ全車(12H_trf 上下計)にフォールバック。
  const kg = KOGATA_12H[best.census]
  const isKogata = Array.isArray(kg)
  const up = isKogata ? kg[0] : null
  const down = isKogata ? kg[1] : null
  // 片側（多い方）を採用
  const side = isKogata ? Math.max(up ?? 0, down ?? 0) : null
  const traffic_12h = isKogata ? Math.round(side as number) : Math.round(best.traffic)

  return NextResponse.json({
    found: true,
    traffic_12h, // 片側(多い方)の小型車12時間。未収録県は全車(上下計)
    traffic_up: up,
    traffic_down: down,
    traffic_12h_all: Math.round(best.traffic), // 参考: 全車（上下合計）
    vehicle: isKogata ? "小型車(片側)" : "全車",
    distance_m: Math.round(best.d),
    road_class: LAYER_LABEL[best.layer] ?? best.layer,
    census_no: best.census,
    lanes: best.lanes,
    source: isKogata
      ? "道路交通センサス 令和3年度（昼間12時間・小型車・片側 多い方）"
      : "道路交通センサス 令和3年度（昼間12時間・全車・上下合計 ※小型車データ未収録県）",
  })
}
