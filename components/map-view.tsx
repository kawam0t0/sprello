"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { CATEGORY_COLORS, PROJECT_CATEGORIES, normalizeCategory } from "@/types/database"
import type { Card, MapItem, ProjectCategory, Store } from "@/types/database"
import { getStores } from "@/lib/database-operations"

const DEFAULT_CENTER = { lat: 36.3912, lng: 139.0608 }
const RADII: { km: number; label: string }[] = [
  { km: 1, label: "1km" },
  { km: 2, label: "2km" },
  { km: 5, label: "5km" },
]

interface MapViewProps {
  cards: Card[]
}

// Card / Store を地図共通アイテムに変換
function storeToItem(s: Store): MapItem | null {
  if (typeof s.latitude !== "number" || typeof s.longitude !== "number") return null
  return {
    id: `store-${s.id}`,
    kind: "store",
    name: s.store_name,
    category: "スプラッシュンゴー",
    lat: s.latitude,
    lng: s.longitude,
    address: s.address,
    brand: s.brand,
    store_code: s.store_code,
    phone: s.phone,
    location_type: s.location_type,
    prefecture: s.prefecture,
    open_date: s.open_date,
    rank: s.rank,
    status: s.status,
    traffic_12h: s.traffic_12h,
    surrounding_score: s.surrounding_score,
    passing_speed: s.passing_speed,
    corner_lot: s.corner_lot,
    visibility: s.visibility,
    awareness: s.awareness,
    household_income: s.household_income,
    size_tsubo: s.size_tsubo,
    car_capacity: s.car_capacity,
    wipe_spaces: s.wipe_spaces,
    pop_1km: s.pop_1km,
    pop_2km: s.pop_2km,
    pop_5km: s.pop_5km,
  }
}

function cardToItem(c: Card): MapItem | null {
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return null
  return {
    id: `project-${c.id}`,
    kind: "project",
    name: c.store_name || c.title,
    category: normalizeCategory(c.category),
    lat: c.lat,
    lng: c.lng,
    address: c.address,
    brand: c.brand,
    location_type: c.location_type,
    prefecture: c.prefecture,
    open_date: c.open_date,
    rank: c.rank,
    status: c.status,
    traffic_12h: c.traffic_12h,
    surrounding_score: c.surrounding_score,
    passing_speed: c.passing_speed,
    corner_lot: c.corner_lot,
    visibility: c.visibility,
    awareness: c.awareness,
    household_income: c.household_income,
    size_tsubo: c.size_tsubo,
    car_capacity: c.car_capacity,
    wipe_spaces: c.wipe_spaces,
    pop_1km: c.pop_1km,
    pop_2km: c.pop_2km,
    pop_5km: c.pop_5km,
  }
}

export function MapView({ cards }: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    getStores().then(setStores)
  }, [])

  const [visibleCats, setVisibleCats] = useState<Record<ProjectCategory, boolean>>({
    スプラッシュンゴー: true,
    "D-Splash": true,
    "丸紅-Splash": true,
  })
  const [activeRadii, setActiveRadii] = useState<Record<number, boolean>>({ 1: false, 2: true, 5: false })
  const [circleAll, setCircleAll] = useState(false)
  const [selected, setSelected] = useState<MapItem | null>(null)

  const allItems = useMemo(() => {
    const s = stores.map(storeToItem).filter(Boolean) as MapItem[]
    const p = cards.map(cardToItem).filter(Boolean) as MapItem[]
    return [...s, ...p]
  }, [stores, cards])

  const visibleItems = useMemo(
    () => allItems.filter((it) => visibleCats[it.category]),
    [allItems, visibleCats],
  )

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50">
        <div className="text-lg font-semibold text-gray-700 mb-2">Google Maps APIキーが未設定です</div>
        <p className="text-sm text-gray-500 max-w-md">
          Vercel の環境変数 <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          を設定すると地図が表示されます。
        </p>
      </div>
    )
  }

  const enabledRadii = RADII.filter((r) => activeRadii[r.km]).map((r) => r.km)

  return (
    <div className="h-full flex">
      {/* 左：フィルタパネル */}
      <div className="w-60 shrink-0 border-r bg-white p-4 overflow-y-auto space-y-5">
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">カテゴリ表示</div>
          <div className="space-y-1.5">
            {PROJECT_CATEGORIES.map((cat) => {
              const count = allItems.filter((it) => it.category === cat).length
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
            <input type="checkbox" checked={circleAll} onChange={(e) => setCircleAll(e.target.checked)} />
            全店舗に表示
          </label>
          {!circleAll && <p className="text-xs text-gray-400 mt-1">ピンを選んだ店舗のみ表示</p>}
        </div>

        <div className="text-xs text-gray-400">
          地図上ピン: {visibleItems.length} 件<br />
          （自社店舗 {stores.filter((s) => s.latitude != null).length} 件 / プロジェクト{" "}
          {cards.filter((c) => c.lat != null).length} 件）
        </div>
      </div>

      {/* 右：地図＋サイドパネル */}
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
              items={visibleItems}
              enabledRadii={enabledRadii}
              circleAll={circleAll}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </Map>
        </APIProvider>

        {/* ArmBox風サイドパネル */}
        {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}

// 地図上のマーカー・同心円を命令的に管理
function MapOverlays({
  items,
  enabledRadii,
  circleAll,
  selectedId,
  onSelect,
}: {
  items: MapItem[]
  enabledRadii: number[]
  circleAll: boolean
  selectedId: string | null
  onSelect: (it: MapItem) => void
}) {
  const map = useMap()
  const markersRef = useRef<google.maps.Marker[]>([])
  const circlesRef = useRef<google.maps.Circle[]>([])

  useEffect(() => {
    if (!map || typeof google === "undefined") return
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    items.forEach((it) => {
      const color = CATEGORY_COLORS[it.category]
      const marker = new google.maps.Marker({
        position: { lat: it.lat, lng: it.lng },
        map,
        title: it.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: it.id === selectedId ? 10 : 7,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      })
      marker.addListener("click", () => onSelect(it))
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, items, selectedId, onSelect])

  useEffect(() => {
    if (!map || typeof google === "undefined") return
    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = []

    const targets = circleAll ? items : items.filter((it) => it.id === selectedId)
    targets.forEach((it) => {
      const color = CATEGORY_COLORS[it.category]
      enabledRadii.forEach((km) => {
        circlesRef.current.push(
          new google.maps.Circle({
            map,
            center: { lat: it.lat, lng: it.lng },
            radius: km * 1000,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: color,
            fillOpacity: 0.06,
            clickable: false,
          }),
        )
      })
    })

    return () => {
      circlesRef.current.forEach((c) => c.setMap(null))
      circlesRef.current = []
    }
  }, [map, items, enabledRadii, circleAll, selectedId])

  return null
}

// ArmBox風の店舗詳細サイドパネル
function DetailPanel({ item, onClose }: { item: MapItem; onClose: () => void }) {
  const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString())
  const txt = (v: string | null | undefined) => (v == null || v === "" ? "—" : v)
  const bool = (v: boolean | null | undefined) => (v == null ? "—" : v ? "○" : "×")

  const rows: [string, string][] = [
    ["カテゴリ", txt(item.category)],
    ["ブランド", txt(item.brand)],
    ["ステータス", txt(item.status)],
    ["立地タイプ", txt(item.location_type)],
    ["都道府県", txt(item.prefecture)],
    ["住所", txt(item.address)],
    ["開店日", txt(item.open_date)],
    ["ランク", txt(item.rank)],
    ["日中12時間交通量", fmt(item.traffic_12h)],
    ["周辺充実度", fmt(item.surrounding_score)],
    ["通過速度", fmt(item.passing_speed)],
    ["角地", bool(item.corner_lot)],
    ["視認性", bool(item.visibility)],
    ["認知度", fmt(item.awareness)],
    ["世帯年収（万円）", fmt(item.household_income)],
    ["広さ（坪）", fmt(item.size_tsubo)],
    ["何台並べるか", fmt(item.car_capacity)],
    ["拭上げスペース数", fmt(item.wipe_spaces)],
    ["同心円1.0km人口", fmt(item.pop_1km)],
    ["同心円2.0km人口", fmt(item.pop_2km)],
    ["同心円5.0km人口", fmt(item.pop_5km)],
  ]
  if (item.phone) rows.splice(6, 0, ["電話番号", txt(item.phone)])

  return (
    <div className="absolute top-3 left-3 z-10 w-[340px] max-h-[calc(100%-24px)] overflow-y-auto rounded-lg shadow-xl bg-white">
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-lg text-white"
        style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
      >
        <div className="font-bold text-base truncate">{item.name}</div>
        <button onClick={onClose} className="ml-2 rounded-full hover:bg-white/20 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-2 py-2">
        <div className="text-[11px] text-gray-400 px-2 pb-1">
          {item.kind === "store" ? "自社店舗" : "プロジェクト"}
          {item.store_code ? `・No.${item.store_code}` : ""}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b last:border-b-0">
                <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap align-top w-1/2 bg-gray-50">
                  {k}
                </td>
                <td className="py-1.5 px-2 text-gray-800 break-words">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
