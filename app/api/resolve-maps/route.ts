import { NextResponse } from "next/server"

// 短縮GoogleマップURLを展開して緯度経度を取り出す
function parse(url: string): { lat: number; lng: number } | null {
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  m = url.match(/[?&](?:q|ll|query|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  m = url.match(/(-?\d{1,2}\.\d{4,}),(-?\d{2,3}\.\d{4,})/)
  if (m) return { lat: +m[1], lng: +m[2] }
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 })

    // まずそのままのURLを解析
    const direct = parse(url)
    if (direct) return NextResponse.json(direct)

    // リダイレクトを追って最終URL・本文から座標を探す
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SprelloBot/1.0)" },
    })

    const fromFinalUrl = parse(res.url || "")
    if (fromFinalUrl) return NextResponse.json(fromFinalUrl)

    const body = await res.text()
    const fromBody = parse(body)
    if (fromBody) return NextResponse.json(fromBody)

    return NextResponse.json({ lat: null, lng: null, note: "座標を特定できませんでした" })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "resolve error", lat: null, lng: null },
      { status: 200 },
    )
  }
}
