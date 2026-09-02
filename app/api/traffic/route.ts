import { NextRequest, NextResponse } from "next/server"

// 道路交通センサス（令和3年度 一般交通量調査）の「昼間12時間交通量」を
// 候補地の緯度経度から最寄り調査区間で取得する。
// 国交省の可視化ツールが配信している公開GeoJSONタイル（z=13/道路種別別レイヤ）を
// サーバー側で直接読み、最寄り区間の 12H_trf（昼間12時間交通量・全車上下計）を返す。
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

  let best:
    | {
        d: number
        traffic: number
        layer: string
        census: string
        speed: number | null
        lanes: number | null
        props: Record<string, any>
      }
    | null = null
  for (const { layer, features } of results) {
    if (!features) continue
    for (const f of features) {
      const t = Number(f?.properties?.["12H_trf"])
      if (!Number.isFinite(t)) continue
      const d = minDistToGeom(lat, lng, f.geometry)
      if (!best || d < best.d) {
        best = {
          d,
          traffic: t,
          layer,
          census: String(f?.properties?.census ?? ""),
          speed: Number.isFinite(Number(f?.properties?.speed_DT)) ? Number(f.properties.speed_DT) : null,
          lanes: Number.isFinite(Number(f?.properties?.Linenum)) ? Number(f.properties.Linenum) : null,
          props: f?.properties ?? {},
        }
      }
    }
  }

  // デバッグ: 最寄り区間の全プロパティを返す（フィールド名確認用。?debug=1）
  if (searchParams.get("debug") === "1") {
    return NextResponse.json({
      found: !!best,
      distance_m: best ? Math.round(best.d) : null,
      layer: best?.layer ?? null,
      properties: best?.props ?? null,
    })
  }

  // 最寄り区間が遠すぎる場合は代表性が低いので「見つからない」とする
  const MAX_DIST = 2000
  if (!best || best.d > MAX_DIST) {
    return NextResponse.json({
      found: false,
      message: "近くに交通量調査区間が見つかりませんでした（半径約2km内）。手入力してください。",
    })
  }

  return NextResponse.json({
    found: true,
    traffic_12h: Math.round(best.traffic),
    distance_m: Math.round(best.d),
    road_class: LAYER_LABEL[best.layer] ?? best.layer,
    census_no: best.census,
    lanes: best.lanes,
    source: "道路交通センサス 令和3年度 一般交通量調査（昼間12時間交通量）",
  })
}
