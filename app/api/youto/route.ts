import { NextRequest, NextResponse } from "next/server"

// 国土交通省「不動産情報ライブラリ」用途地域タイルAPI(XKT002)のサーバー側プロキシ。
// APIキー(Ocp-Apim-Subscription-Key)はサーバー環境変数 REINFOLIB_API_KEY に保持し、
// ブラウザには出さない。z/x/y(標準XYZ・z=11〜15)を受けてGeoJSONを返す。
const ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XKT002"

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
    // キー未設定でもUIが壊れないように 200 で通知
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
        // 用途地域はほぼ不変なのでキャッシュ
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch (e) {
    console.error("[youto] fetch error:", e)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 200 })
  }
}
