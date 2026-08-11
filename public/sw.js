// 最小限のサービスワーカー。Chrome の「アプリをインストール」要件を満たしつつ、
// ページ本体の取得はネットワーク優先にしてオフライン時のみキャッシュへフォールバック。
const CACHE = "sprello-v1"
const PRECACHE = ["/", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  // 同一オリジンのみ扱う。API はキャッシュしない（常に最新を取得）。
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
  )
})
