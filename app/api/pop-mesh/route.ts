import { NextRequest, NextResponse } from "next/server"

// 国土交通省「不動産情報ライブラリ」将来推計人口250mメッシュAPI(XKT013)のサーバー側プロキシ。
// 用途地域(/api/youto)と同じくAPIキー(REINFOLIB_API_KEY)をサーバー側に保持。
// z/x/y(標準XYZ・z=11〜15)を受けてGeoJSONを返す。基準年2020の人口(PTN_2020)等を含む。
const ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XKT013"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const z = searchParams.get("z")
  const x = searchParams.get("x")
  const y = searchParams.get("y")
  if (!z || !x || !y) {
    return NextResponse.json({ error: "z/x/y が必要です" }, { status: 400 })
  }

  const key = process.env.REINFOLIB_API_KEY
  if (!key) {
    return NextResponse.json({ error: "NO_KEY" })
  }

  const url = `${ENDPOINT}?response_format=geojson&z=${z}&x=${x}&y=${y}`
  try {
    const res = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `REINFOLIB ${res.status}` }, { status: 200 })
    }
    const data = await res.json()
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch (e) {
    console.error("[pop-mesh] fetch error:", e)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 200 })
  }
}
