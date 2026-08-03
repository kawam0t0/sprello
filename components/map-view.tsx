"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { CATEGORY_COLORS, PROJECT_CATEGORIES } from "@/types/database"
import type { Card, ProjectCategory } from "@/types/database"

// 群馬県中心あたりを初期表示
const DEFAULT_CENTER = { lat: 36.3912, lng: 139.0608 }
const RADII: { km: number; label: string }[] = [
  { km: 1, label: "1km" },
  { km: 2, label: "2km" },
  { km: 5, label: "5km" },
]

interface MapViewProps {
  cards: Card[]
}

export function MapView({ cards }: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // カテゴリ表示ON/OFF
  const [visibleCats, setVisibleCats] = useState<Record<ProjectCategory, boolean>>({
    自社店舗: true,
    物件: true,
    出店ターゲット: true,
    閉店店舗: true,
    競合: true,
  })
  // 同心円の半径ON/OFF
  const [activeRadii, setActiveRadii] = useState<Record<number, boolean>>({ 1: false, 2: true, 5: false })
  // 「全店舗に同心円を表示」か「選択した店舗のみ」か
  const [circleAll, setCircleAll] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mappable = useMemo(
    () => cards.filter((c) => typeof c.lat === "number" && typeof c.lng === "number"),
    [cards],
  )

  const visibleCards = useMemo(
    () => mappable.filter((c) => visibleCats[(c.category as ProjectCategory) ?? "自社店舗"]),
    [mappable, visibleCats],
  )

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50">
        <div className="text-lg font-semibold text-gray-700 mb-2">Google Maps APIキーが未設定です</div>
        <p className="text-sm text-gray-500 max-w-md">
          Vercel の環境変数 <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          を設定すると地図が表示されます。（Maps JavaScript API と Geocoding API を有効化したキー）
        </p>
      </div>
    )
  }

  const enabledRadii = RADII.filter((r) => activeRadii[r.km]).map((r) => r.km)

  return (
    <div className="h-full flex">
      {/* 左：フィルタパネル */}
      <div className="w-64 shrink-0 border-r bg-white p-4 overflow-y-auto space-y-5">
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">施設表示</div>
          <div className="space-y-1.5">
            {PROJECT_CATEGORIES.map((cat) => {
              const count = mappable.filter((c) => (c.category ?? "自社店舗") === cat).length
              return (
                <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={visibleCats[cat]}
                    onChange={(e) => setVisibleCats((p) => ({ ...p, [cat]: e.target.checked }))}
                  />
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  <span className="flex-1">{cat}</span>
                  <span className="text-gray-400 text-xs">{count}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">同心円（商圏）</div>
          <div className="flex gap-2 mb-2">
            {RADII.map((r) => (
              <button
                key={r.km}
                onClick={() => setActiveRadii((p) => ({ ...p, [r.km]: !p[r.km] }))}
                className={`px-2 py-1 rounded text-xs border ${
                  activeRadii[r.km]
                    ? "bg-yellow-500 text-white border-yellow-500"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={circleAll}
              onChange={(e) => setCircleAll(e.target.checked)}
            />
            全店舗に表示
          </label>
          {!circleAll && (
            <p className="text-xs text-gray-400 mt-1">ピンをクリックした店舗のみ表示</p>
          )}
        </div>

        <div className="text-xs text-gray-400">
          地図上ピン: {visibleCards.length} 件<br />
          （住所未登録の {mappable.length - visibleCards.length >= 0 ? cards.length - mappable.length : 0} 件は非表示）
        </div>
      </div>

      {/* 右：地図 */}
      <div className="flex-1 relative">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={10}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            <MapOverlays
              cards={visibleCards}
              enabledRadii={enabledRadii}
              circleAll={circleAll}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}

// 地図上のマーカー・同心円・情報ウィンドウを命令的に管理
function MapOverlays({
  cards,
  enabledRadii,
  circleAll,
  selectedId,
  onSelect,
}: {
  cards: Card[]
  enabledRadii: number[]
  circleAll: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const map = useMap()
  const markersRef = useRef<google.maps.Marker[]>([])
  const circlesRef = useRef<google.maps.Circle[]>([])
  const infoRef = useRef<google.maps.InfoWindow | null>(null)

  // マーカー描画
  useEffect(() => {
    if (!map || typeof google === "undefined") return
    // 既存マーカー削除
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    if (!infoRef.current) infoRef.current = new google.maps.InfoWindow()

    cards.forEach((c) => {
      const color = CATEGORY_COLORS[(c.category as ProjectCategory) ?? "自社店舗"]
      const marker = new google.maps.Marker({
        position: { lat: c.lat as number, lng: c.lng as number },
        map,
        title: c.store_name || c.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      })
      marker.addListener("click", () => {
        onSelect(c.id)
        const pops = [c.pop_1km, c.pop_2km, c.pop_5km]
        const popRow =
          pops.some((p) => p != null)
            ? `<div style="margin-top:4px;font-size:11px;color:#555">商圏人口 1/2/5km: ${pops
                .map((p) => (p != null ? Number(p).toLocaleString() : "-"))
                .join(" / ")}</div>`
            : ""
        infoRef.current?.setContent(
          `<div style="font-family:sans-serif;min-width:180px">
            <div style="font-weight:bold;font-size:14px">${escapeHtml(c.store_name || c.title || "")}</div>
            <div style="font-size:11px;color:#777">${escapeHtml(c.category ?? "")} ${
            c.rank ? "・ランク" + escapeHtml(c.rank) : ""
          }</div>
            <div style="font-size:12px;margin-top:2px">${escapeHtml(c.address ?? "")}</div>
            ${popRow}
          </div>`,
        )
        infoRef.current?.open(map, marker)
      })
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, cards, onSelect])

  // 同心円描画
  useEffect(() => {
    if (!map || typeof google === "undefined") return
    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = []

    const targets = circleAll ? cards : cards.filter((c) => c.id === selectedId)
    targets.forEach((c) => {
      const color = CATEGORY_COLORS[(c.category as ProjectCategory) ?? "自社店舗"]
      enabledRadii.forEach((km) => {
        const circle = new google.maps.Circle({
          map,
          center: { lat: c.lat as number, lng: c.lng as number },
          radius: km * 1000,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.06,
          clickable: false,
        })
        circlesRef.current.push(circle)
      })
    })

    return () => {
      circlesRef.current.forEach((c) => c.setMap(null))
      circlesRef.current = []
    }
  }, [map, cards, enabledRadii, circleAll, selectedId])

  return null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
