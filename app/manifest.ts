import type { MetadataRoute } from "next"

// PWA マニフェスト。Safari「Dockに追加」/ Chrome「アプリをインストール」で
// 添付のブルー・ドットのアイコンが表示される。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sprello 商圏分析",
    short_name: "Sprello",
    description: "洗車店の出店・商圏分析ツール",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b4da0",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
