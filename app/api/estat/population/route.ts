import { NextResponse } from "next/server"

// 3次メッシュ（約1km）のサイズ
const LAT_UNIT = 1 / 120 // 30秒
const LNG_UNIT = 1 / 80 // 45秒

// 緯度経度 → 3次メッシュコード（8桁）
function meshCode(lat: number, lng: number): string {
  const y = lat * 60
  const p = Math.floor(y / 40)
  const y1 = y - p * 40
  const q = Math.floor(y1 / 5)
  const y2 = y1 - q * 5
  const r = Math.floor(y2 / 0.5)

  const x = lng - 100
  const u = Math.floor(x)
  const x1 = (x - u) * 60
  const v = Math.floor(x1 / 7.5)
  const x2 = x1 - v * 7.5
  const w = Math.floor(x2 / 0.75)

  return `${p}${u}${q}${v}${r}${w}`
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// 中心点まわりの1kmメッシュを生成し、半径リングに割り当てる
function meshesInRadius(lat: number, lng: number) {
  const latSW = Math.floor(lat / LAT_UNIT) * LAT_UNIT
  const lngSW = 100 + Math.floor((lng - 100) / LNG_UNIT) * LNG_UNIT
  const ring: Record<string, number> = {} // meshCode -> 最小到達リング(1/2/5)
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      const cLat = latSW + (i + 0.5) * LAT_UNIT
      const cLng = lngSW + (j + 0.5) * LNG_UNIT
      const d = haversine(lat, lng, cLat, cLng)
      if (d > 5000) continue
      const code = meshCode(cLat, cLng)
      const band = d <= 1000 ? 1 : d <= 2000 ? 2 : 5
      if (!(code in ring) || band < ring[code]) ring[code] = band
    }
  }
  return ring
}

async function estat(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.e-stat.go.jp/rest/3.0/app/json/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  return res.json()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 })
  }

  const appId = process.env.ESTAT_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "ESTAT_APP_ID 未設定" }, { status: 503 })
  }

  const ring = meshesInRadius(lat, lng)
  const codes = Object.keys(ring)

  // データセットID：環境変数優先。無ければ検索で自動特定を試みる。
  let statsDataId = process.env.ESTAT_STATS_DATA_ID || ""
  const diag: any = { meshCount: codes.length, statsDataId, tried: [] as string[] }

  try {
    if (!statsDataId) {
      const list = await estat("getStatsList", {
        appId,
        searchWord: "国勢調査 人口 メッシュ 総数",
        limit: "5",
      })
      const tables = list?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF
      const arr = Array.isArray(tables) ? tables : tables ? [tables] : []
      diag.candidates = arr.map((t: any) => ({ id: t?.["@id"], title: t?.TITLE?.$ ?? t?.TITLE }))
      statsDataId = arr[0]?.["@id"] ?? ""
      diag.statsDataId = statsDataId
    }

    if (!statsDataId) {
      return NextResponse.json({
        error: "統計表IDを特定できませんでした。ESTAT_STATS_DATA_ID を設定してください。",
        diag,
      })
    }

    const data = await estat("getStatsData", {
      appId,
      statsDataId,
      cdArea: codes.join(","),
      cntGetFlg: "N",
      metaGetFlg: "N",
      limit: "100000",
    })

    const status = data?.GET_STATS_DATA?.RESULT?.STATUS
    const errMsg = data?.GET_STATS_DATA?.RESULT?.ERROR_MSG
    diag.status = status
    diag.errMsg = errMsg

    const values: any[] = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? []
    diag.valueSample = values.slice(0, 5)
    diag.cats = Array.from(new Set(values.map((v) => v?.["@cat01"]).filter(Boolean))).slice(0, 10)

    // area ごとに最大値（＝総人口とみなす）を採用
    const areaVal: Record<string, number> = {}
    for (const v of values) {
      const area = v?.["@area"]
      const num = Number(v?.["$"])
      if (!area || !Number.isFinite(num)) continue
      if (!(area in areaVal) || num > areaVal[area]) areaVal[area] = num
    }

    let pop_1km = 0
    let pop_2km = 0
    let pop_5km = 0
    for (const [code, band] of Object.entries(ring)) {
      const val = areaVal[code]
      if (val == null) continue
      if (band <= 1) pop_1km += val
      if (band <= 2) pop_2km += val
      pop_5km += val
    }

    return NextResponse.json({ pop_1km, pop_2km, pop_5km, diag })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "estat error", diag },
      { status: 200 },
    )
  }
}
