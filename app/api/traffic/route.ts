import { NextRequest, NextResponse } from "next/server"

// 国土交通省 道路データプラットフォーム / JARTIC 常時観測交通量（国管理道路）
// WFS(GetFeature)で候補地周辺の観測点を取得し、最寄り1点の「日中12時間交通量」を返す。
// 無料・APIキー不要。1時間値は過去3ヶ月分が取得可能。
const JARTIC = "https://api.jartic-open-traffic.org/geoserver"

// 交通量の集計対象プロパティ（上り/下り × 小型/大型）
const COUNT_KEYS = [
  "上り・小型交通量",
  "上り・大型交通量",
  "下り・小型交通量",
  "下り・大型交通量",
]
// 観測点名の候補キー（存在すれば表示に使う）
const NAME_KEYS = ["観測点名", "地点名", "名称", "常時観測点名称"]

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// JST基準で offsetDays 日前の年月日と曜日(0=日)を返す
function jstDate(offsetDays: number): { ymd: string; dow: number } {
  const d = new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const ymd = `${y}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}`
  return { ymd, dow: d.getUTCDay() }
}

// 直近の平日(月〜金)を最大 tries 日分、新しい順に返す
function recentWeekdays(tries: number): string[] {
  const out: string[] = []
  let off = 1 // 前日から
  while (out.length < tries && off <= 14) {
    const { ymd, dow } = jstDate(off)
    if (dow >= 1 && dow <= 5) out.push(ymd)
    off++
  }
  return out
}

async function wfsFetch(cqlFilter: string): Promise<any | null> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "t_travospublic_measure_1h",
    srsName: "EPSG:4326",
    outputFormat: "application/json",
    exceptions: "application/json",
    cql_filter: cqlFilter,
    count: "10000",
  })
  const url = `${JARTIC}?${params.toString()}`
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) {
      console.warn("[traffic] WFS status", res.status)
      return null
    }
    return await res.json()
  } catch (e) {
    console.error("[traffic] WFS fetch error:", e)
    return null
  }
}

type PointAgg = {
  code: string
  name?: string
  lat: number
  lng: number
  total: number
}

// 1日分(07:00〜18:00の12時間)を集計し、観測点ごとに合算
function aggregateDay(fc: any): Map<string, PointAgg> {
  const map = new Map<string, PointAgg>()
  const feats: any[] = Array.isArray(fc?.features) ? fc.features : []
  for (const f of feats) {
    const p = f?.properties ?? {}
    const code = String(p["常時観測点コード"] ?? "")
    if (!code) continue
    const coords = f?.geometry?.coordinates
    // Point もしくは MultiPoint の先頭
    let lng: number | undefined
    let lat: number | undefined
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number") {
        lng = coords[0]
        lat = coords[1]
      } else if (Array.isArray(coords[0])) {
        lng = coords[0][0]
        lat = coords[0][1]
      }
    }
    let sum = 0
    for (const k of COUNT_KEYS) {
      const v = Number(p[k])
      if (Number.isFinite(v)) sum += v
    }
    const nameKey = NAME_KEYS.find((k) => p[k])
    const cur = map.get(code)
    if (cur) {
      cur.total += sum
    } else {
      map.set(code, {
        code,
        name: nameKey ? String(p[nameKey]) : undefined,
        lat: lat ?? 0,
        lng: lng ?? 0,
        total: sum,
      })
    }
  }
  return map
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 })
  }

  // 検索範囲（約±5km）
  const latHalf = 0.05
  const lngHalf = 0.05 / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const minLon = (lng - lngHalf).toFixed(6)
  const maxLon = (lng + lngHalf).toFixed(6)
  const minLat = (lat - latHalf).toFixed(6)
  const maxLat = (lat + latHalf).toFixed(6)
  const bbox = `BBOX(ジオメトリ,${minLon},${minLat},${maxLon},${maxLat},'EPSG:4326')`

  // 見つかった最寄り点を採用できる上限距離（約4km）
  const MAX_DIST = 4000

  for (const ymd of recentWeekdays(4)) {
    const from = `${ymd}0700`
    const to = `${ymd}1800`
    const timeRange = `時間コード>=${from} AND 時間コード<=${to}`

    // 道路種別=3(国道)。数値/文字列どちらの格納でも通るよう順に試す
    let fc = await wfsFetch(`道路種別=3 AND ${timeRange} AND ${bbox}`)
    let agg = fc ? aggregateDay(fc) : new Map<string, PointAgg>()
    if (agg.size === 0) {
      fc = await wfsFetch(`道路種別='3' AND ${timeRange} AND ${bbox}`)
      agg = fc ? aggregateDay(fc) : new Map<string, PointAgg>()
    }
    if (agg.size === 0) continue

    // 最寄り観測点を選ぶ
    let best: PointAgg | null = null
    let bestDist = Infinity
    for (const pt of agg.values()) {
      if (!pt.lat || !pt.lng) continue
      const d = distM(lat, lng, pt.lat, pt.lng)
      if (d < bestDist) {
        bestDist = d
        best = pt
      }
    }
    if (!best || bestDist > MAX_DIST) continue
    if (!(best.total > 0)) continue // その日は欠測 → 別の平日で再試行

    return NextResponse.json({
      found: true,
      traffic_12h: Math.round(best.total),
      point_code: best.code,
      point_name: best.name ?? null,
      distance_m: Math.round(bestDist),
      date: ymd,
      source: "国交省 道路データプラットフォーム(JARTIC常時観測)",
    })
  }

  return NextResponse.json({
    found: false,
    message: "近くに国道の交通量観測点が見つかりませんでした（半径約4km内）",
  })
}
