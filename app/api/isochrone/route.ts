import { NextRequest, NextResponse } from "next/server"

// ある地点から車でN分以内に到達できる範囲（到達圏＝アイソクロン）。
// 道路ネットワークを実際にルーティングする OpenRouteService の到達圏APIを
// サーバ側でプロキシする（APIキーを秘匿）。
// 無料アカウントで OPENROUTESERVICE_API_KEY を発行し、Vercelの環境変数に設定する。
// 参考: https://openrouteservice.org  （無料枠：到達圏は1日500回まで）
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "BAD_BODY" }, { status: 400 })
  }

  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "BAD_LATLNG" }, { status: 400 })
  }

  // 分 → 秒。既定は 5/10/15 分。
  const minutes: number[] =
    Array.isArray(body?.minutes) && body.minutes.length
      ? body.minutes.map((m: any) => Number(m)).filter((m: number) => Number.isFinite(m) && m > 0)
      : [5, 10, 15]
  const range = Array.from(new Set(minutes.map((m) => Math.round(m * 60)))).sort((a, b) => a - b)

  const allowed = new Set(["driving-car", "foot-walking", "cycling-regular"])
  const profile =
    typeof body?.profile === "string" && allowed.has(body.profile) ? body.profile : "driving-car"

  const key = process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY
  if (!key) return NextResponse.json({ error: "NO_KEY" })

  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/isochrones/${profile}`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range,
        range_type: "time",
        location_type: "start",
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[isochrone] ORS error", res.status, text.slice(0, 300))
      return NextResponse.json({ error: "UPSTREAM", status: res.status })
    }
    const geojson = await res.json()
    return NextResponse.json({ found: true, geojson })
  } catch (e) {
    console.error("[isochrone] error", e)
    return NextResponse.json({ error: "FETCH" })
  }
}
