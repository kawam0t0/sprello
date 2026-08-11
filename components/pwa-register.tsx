"use client"

import { useEffect } from "react"

// サービスワーカーを登録する（クライアント側のみ）。
// Chrome/Edge の「アプリをインストール」やオフライン対応に必要。
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])
  return null
}
