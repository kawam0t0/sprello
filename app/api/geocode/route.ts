import { NextResponse } from "next/server"

// 住所 → 緯度経度（Google Geocoding API）
// サーバー側でキーを使うため、キーはクライアントに露出しません。
export async function POST(request: Request) {
  try {
    const { address } = await request.json()

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 })
    }

    // サーバー専用キーを優先。無ければ公開キーにフォールバック。
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps APIキーが未設定です（GOOGLE_MAPS_API_KEY）" },
        { status: 503 },
      )
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.searchParams.set("address", address)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("language", "ja")
    url.searchParams.set("region", "jp")

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json(
        { error: `ジオコーディング失敗: ${data.status}`, lat: null, lng: null },
        { status: 200 },
      )
    }

    const loc = data.results[0].geometry.location
    return NextResponse.json({ lat: loc.lat, lng: loc.lng, status: "OK" })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "geocode error", lat: null, lng: null },
      { status: 500 },
    )
  }
}
