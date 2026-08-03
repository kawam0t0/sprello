// Google Maps JS API をブラウザで一度だけ読み込むローダー。
// 地図表示（@vis.gl/react-google-maps）が既に読み込んでいればそれを再利用する。
// これにより、住所→緯度経度の変換をブラウザ側（リファラー許可済みキー）で実行でき、
// サーバー用の追加キーが不要になる。

let loadPromise: Promise<any> | null = null

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"))
  }
  const w = window as any
  if (w.google?.maps) {
    return Promise.resolve(w.google)
  }
  if (loadPromise) return loadPromise

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"))
  }

  loadPromise = new Promise((resolve, reject) => {
    // 既に別経路で読み込み中のスクリプトがあれば待つ
    const existing = document.getElementById("gmaps-js") as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve(w.google))
      existing.addEventListener("error", reject)
      return
    }
    const script = document.createElement("script")
    script.id = "gmaps-js"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&language=ja&region=JP`
    script.async = true
    script.defer = true
    script.onload = () => resolve(w.google)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return loadPromise
}
