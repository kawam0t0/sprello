// GoogleマップのURL（候補地URL）から緯度経度を取り出す。
// 住所が未確定でも、URLさえあれば地図にピンを立てられるようにする。

export function parseLatLngFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null
  // 例: .../@36.3716,139.0804,17z/...
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  // 例: ...!3d36.3716!4d139.0804...（placeデータ）
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  // 例: ?q=36.3716,139.0804 / &ll= / &center= / &destination=
  m = url.match(/[?&](?:q|ll|query|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  // 経路やパス中に素の "lat,lng" があるケース
  m = url.match(/(-?\d{1,2}\.\d{4,}),(-?\d{2,3}\.\d{4,})/)
  if (m) return { lat: +m[1], lng: +m[2] }
  return null
}

// 短縮URL（maps.app.goo.gl 等）は展開しないと座標が取れない
export function isShortMapsUrl(url: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|goo\.gl\/)/i.test(url)
}

// 候補地URL → 緯度経度（短縮URLはサーバーAPIで展開してから解析）
export async function resolveLatLngFromUrl(
  url: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!url?.trim()) return null
  const direct = parseLatLngFromUrl(url)
  if (direct) return direct
  // 短縮URLなどはサーバー側で展開
  try {
    const res = await fetch(`/api/resolve-maps?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng }
    }
  } catch (e) {
    console.warn("[resolveLatLngFromUrl] error:", e)
  }
  return null
}
