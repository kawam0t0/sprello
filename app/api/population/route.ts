import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// 3次メッシュ（約1km）のセルサイズ
const LAT_U = 1 / 120
const LNG_U = 1 / 80

// セルを4x4に細分してサンプリング（面積按分の近似）
const SUBS: [number, number][] = []
for (const a of [-3 / 8, -1 / 8, 1 / 8, 3 / 8]) {
  for (const b of [-3 / 8, -1 / 8, 1 / 8, 3 / 8]) SUBS.push([a, b])
}

function hav(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 })
  }

  // 5km+をカバーするバウンディングボックスでメッシュを取得
  const { data, error } = await supabase
    .from("mesh_population")
    .select("lat,lng,population,households")
    .gte("lat", lat - 0.06)
    .lte("lat", lat + 0.06)
    .gte("lng", lng - 0.075)
    .lte("lng", lng + 0.075)

  if (error) {
    return NextResponse.json({ error: `mesh_population 取得失敗: ${error.message}` }, { status: 200 })
  }
  const rows = data ?? []
  if (rows.length === 0) {
    return NextResponse.json({
      error: "この地点周辺のメッシュ人口データがありません（対象都道府県のCSV未取込かもしれません）",
      pop_1km: null,
      pop_2km: null,
      pop_5km: null,
    })
  }

  const pop = { 1: 0, 2: 0, 5: 0 }
  const hh = { 1: 0, 2: 0, 5: 0 }
  for (const r of rows) {
    const cLat = r.lat as number
    const cLng = r.lng as number
    const cnt = { 1: 0, 2: 0, 5: 0 }
    for (const [da, db] of SUBS) {
      const d = hav(lat, lng, cLat + da * LAT_U, cLng + db * LNG_U)
      if (d <= 1000) cnt[1]++
      if (d <= 2000) cnt[2]++
      if (d <= 5000) cnt[5]++
    }
    const p = (r.population as number) || 0
    const h = (r.households as number) || 0
    for (const km of [1, 2, 5] as const) {
      pop[km] += (p * cnt[km]) / 16
      hh[km] += (h * cnt[km]) / 16
    }
  }

  return NextResponse.json({
    pop_1km: Math.round(pop[1]),
    pop_2km: Math.round(pop[2]),
    pop_5km: Math.round(pop[5]),
    hh_1km: Math.round(hh[1]),
    hh_2km: Math.round(hh[2]),
    hh_5km: Math.round(hh[5]),
    meshCount: rows.length,
  })
}
