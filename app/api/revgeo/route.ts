import { NextRequest, NextResponse } from "next/server"
import { MUNI_INCOME, MUNI_NAME } from "@/lib/muni-income"

// 緯度経度 → 市区町村（国土地理院 逆ジオコーダ）＋おおよその所得(万円)。
// GSIの逆ジオコーダは muniCd と町名(lv01Nm) を返す。muniCd から所得マスタを引く。
// キー不要・無料。
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) return NextResponse.json({ found: false })
    const data = await res.json()
    const muniCd: string = String(data?.results?.muniCd ?? "")
    const town: string = String(data?.results?.lv01Nm ?? "")
    if (!muniCd) return NextResponse.json({ found: false, town })

    // 先頭の0が落ちる場合に備えて5桁ゼロ埋め。政令市の区は市(XX100)にフォールバック。
    const cd5 = muniCd.padStart(5, "0")
    const cityCd = cd5.slice(0, 3) + "00"
    const income = MUNI_INCOME[cd5] ?? MUNI_INCOME[cityCd] ?? null
    const city = MUNI_NAME[cd5] ?? MUNI_NAME[cityCd] ?? null

    // 個人(1人当たり課税所得)→ 推計世帯年収。世帯の稼ぎ手数・所得→収入補正の暫定係数。
    const HOUSEHOLD_FACTOR = 1.7
    const income_household = income == null ? null : Math.round(income * HOUSEHOLD_FACTOR)

    return NextResponse.json({ found: true, muniCd, town, city, income, income_household })
  } catch (e) {
    console.error("[revgeo] error:", e)
    return NextResponse.json({ found: false })
  }
}
