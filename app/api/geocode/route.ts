import { NextResponse } from "next/server"

// 住所 → 緯度経度。
// 日本の住所に強くキー不要の「国土地理院 住所検索API」を最優先で使う。
// （GoogleキーがGeocoding API未許可で REQUEST_DENIED になる問題を回避）
// 取れないときのみ Google Geocoding にフォールバック。
export async function POST(request: Request) {
  try {
    const { address } = await request.json()

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 })
    }

    // 全角数字・ハイフンを半角へ正規化
    const q = address
      .replace(/[０-９]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/[−–—―ー－]/g, "-")
      .trim()

    // 1) 国土地理院 住所検索API（無料・キー不要）
    try {
      const gsi = await fetch(
        "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(q),
      )
      if (gsi.ok) {
        const arr = await gsi.json()
        const c = Array.isArray(arr) && arr[0]?.geometry?.coordinates
        if (Array.isArray(c) && c.length >= 2) {
          const lng = Number(c[0]),
            lat = Number(c[1])
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return NextResponse.json({ lat, lng, status: "OK", source: "GSI" })
          }
        }
      }
    } catch (e) {
      console.warn("[api/geocode] GSI失敗:", e)
    }

    // 2) Google Geocoding（フォールバック）
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (apiKey) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      url.searchParams.set("address", q)
      url.searchParams.set("key", apiKey)
      url.searchParams.set("language", "ja")
      url.searchParams.set("region", "jp")
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.status === "OK" && data.results?.length) {
        const loc = data.results[0].geometry.location
        return NextResponse.json({ lat: loc.lat, lng: loc.lng, status: "OK", source: "google" })
      }
      return NextResponse.json(
        { error: `ジオコーディング失敗: ${data.status}`, lat: null, lng: null },
        { status: 200 },
      )
    }

    return NextResponse.json({ error: "住所を特定できませんでした", lat: null, lng: null }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "geocode error", lat: null, lng: null },
      { status: 500 },
    )
  }
}
