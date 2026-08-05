"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Pencil, Menu } from "lucide-react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { CATEGORY_COLORS, PROJECT_CATEGORIES, normalizeCategory } from "@/types/database"
import type { Card, MapItem, ProjectCategory, Store } from "@/types/database"
import { getStores, updateStore } from "@/lib/database-operations"
import { StoreForm } from "@/components/store-form"

const DEFAULT_CENTER = { lat: 36.3912, lng: 139.0608 }
const RADII: { km: number; label: string }[] = [
  { km: 1, label: "1km" },
  { km: 2, label: "2km" },
  { km: 5, label: "5km" },
]

interface MapViewProps {
  cards: Card[]
}

function storeToItem(s: Store): MapItem | null {
  if (typeof s.latitude !== "number" || typeof s.longitude !== "number") return null
  return {
    id: `store-${s.id}`,
    kind: "store",
    name: s.store_name,
    category: normalizeCategory(s.category),
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
  const refreshStores = () => getStores().then(setStores)
  useEffect(() => {
    refreshStores()
  }, [])

  const [visibleCats, setVisibleCats] = useState<Record<ProjectCategory, boolean>>({
    スプラッシュンゴー: true,
    "D-Splash": true,
    "丸紅-Splash": true,
  })
  const [activeRadii, setActiveRadii] = useState<Record<number, boolean>>({ 1: false, 2: true, 5: false })
  const [circleAll, setCircleAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  const [editStore, setEditStore] = useState<Store | null>(null)
  const [saving, setSaving] = useState(false)

  const allItems = useMemo(() => {
    const s = stores.map(storeToItem).filter(Boolean) as MapItem[]
    const p = cards.map(cardToItem).filter(Boolean) as MapItem[]
    return [...s, ...p]
  }, [stores, cards])

  const visibleItems = useMemo(
    () => allItems.filter((it) => visibleCats[it.category]),
    [allItems, visibleCats],
  )

  // 選択はIDで保持し、最新データから列を作る（比較用）
  const selectedItems = useMemo(
    () => selectedIds.map((id) => allItems.find((it) => it.id === id)).filter(Boolean) as MapItem[],
    [selectedIds, allItems],
  )
  const toggleSelect = (it: MapItem) =>
    setSelectedIds((prev) => (prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]))

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

  const handleEditItem = (item: MapItem) => {
    if (item.kind !== "store") return
    const realId = item.id.replace("store-", "")
    setEditStore(stores.find((x) => x.id === realId) ?? null)
  }

  const handleSaveStore = async (id: string, patch: Partial<Store>) => {
    try {
      setSaving(true)
      await updateStore(id, patch)
      await refreshStores()
      setEditStore(null)
    } catch (e) {
      alert("保存に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full relative flex">
      {/* 左：選択したピンの詳細を横並び（列）で比較。地図は右に残る */}
      {selectedItems.length > 0 && (
        <div className="shrink-0 border-r bg-white flex flex-col" style={{ width: "min(480px, 52vw)" }}>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 text-white">
            <span className="text-sm font-bold">施設詳細（比較 {selectedItems.length} 件）</span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs bg-white/15 hover:bg-white/25 px-2 py-1 rounded"
            >
              全てクリア
            </button>
          </div>
          <CompareTable
            items={selectedItems}
            onRemove={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
            onEdit={handleEditItem}
          />
        </div>
      )}

      {/* 地図（メイン） */}
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
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          </Map>
        </APIProvider>

        {/* ハンバーガー：カテゴリ表示・同心円 */}
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="bg-white shadow-md rounded-md p-2 hover:bg-gray-50 border border-gray-200"
            title="表示設定"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          {filterOpen && (
            <div className="mt-2 w-56 bg-white rounded-lg shadow-xl border p-3 space-y-4">
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
                          ? "bg-[#1b4da0] text-white border-[#1b4da0]"
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
              </div>

              <div className="text-[11px] text-gray-400 border-t pt-2">
                ピン {visibleItems.length} 件（自社 {stores.filter((s) => s.latitude != null).length} / PJ{" "}
                {cards.filter((c) => c.lat != null).length}）
              </div>
            </div>
          )}
        </div>
      </div>

      <StoreForm
        store={editStore}
        open={!!editStore}
        onOpenChange={(o) => !o && setEditStore(null)}
        onSubmit={handleSaveStore}
        submitting={saving}
      />
    </div>
  )
}

// ---- 見やすいラベル付きピン ----
function shortName(name: string): string {
  const n = name.replace(/SPLASH'N'GO!/gi, "").replace(/スプラッシュンゴー/g, "").trim() || name
  return n.length > 12 ? n.slice(0, 12) + "…" : n
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildPin(label: string, color: string, selected: boolean): { url: string; w: number; h: number } {
  const textW = Math.max(label.length * 13, 20)
  const w = Math.ceil(30 + textW + 12)
  const h = 40
  const stroke = selected ? "#111827" : color
  const sw = selected ? 3 : 1.5
  const cx = w / 2
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<rect x='1.5' y='1.5' rx='14' ry='14' width='${w - 3}' height='28' fill='white' stroke='${stroke}' stroke-width='${sw}'/>` +
    `<circle cx='18' cy='15.5' r='7' fill='${color}'/>` +
    `<circle cx='18' cy='15.5' r='2.6' fill='white'/>` +
    `<text x='32' y='20.5' font-family='sans-serif' font-size='13' font-weight='700' fill='#1f2937'>${escapeXml(label)}</text>` +
    `<path d='M ${cx - 7},29 L ${cx + 7},29 L ${cx},39 Z' fill='white' stroke='${stroke}' stroke-width='${sw}'/>` +
    `<path d='M ${cx - 6},30 L ${cx + 6},30 L ${cx},38 Z' fill='white'/>` +
    `</svg>`
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), w, h }
}

function MapOverlays({
  items,
  enabledRadii,
  circleAll,
  selectedIds,
  onSelect,
}: {
  items: MapItem[]
  enabledRadii: number[]
  circleAll: boolean
  selectedIds: string[]
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
      const selected = selectedIds.includes(it.id)
      const pin = buildPin(shortName(it.name), color, selected)
      const marker = new google.maps.Marker({
        position: { lat: it.lat, lng: it.lng },
        map,
        title: it.name,
        zIndex: selected ? 999 : 1,
        icon: {
          url: pin.url,
          scaledSize: new google.maps.Size(pin.w, pin.h),
          anchor: new google.maps.Point(pin.w / 2, pin.h),
        },
      })
      marker.addListener("click", () => onSelect(it))
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, items, selectedIds, onSelect])

  useEffect(() => {
    if (!map || typeof google === "undefined") return
    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = []

    const targets = circleAll ? items : items.filter((it) => selectedIds.includes(it.id))
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
  }, [map, items, enabledRadii, circleAll, selectedIds])

  return null
}

// ---- ArmBox風の複数店舗 比較パネル ----
const COMPARE_ROWS: { label: string; get: (it: MapItem) => string }[] = (() => {
  const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString())
  const txt = (v: string | null | undefined) => (v == null || v === "" ? "—" : v)
  const bool = (v: boolean | null | undefined) => (v == null ? "—" : v ? "○" : "×")
  return [
    { label: "区分", get: (it) => (it.kind === "store" ? "自社店舗" : "プロジェクト") },
    { label: "カテゴリ", get: (it) => txt(it.category) },
    { label: "物件/店舗No", get: (it) => txt(it.store_code) },
    { label: "ブランド", get: (it) => txt(it.brand) },
    { label: "ステータス", get: (it) => txt(it.status) },
    { label: "立地タイプ", get: (it) => txt(it.location_type) },
    { label: "都道府県", get: (it) => txt(it.prefecture) },
    { label: "住所", get: (it) => txt(it.address) },
    { label: "電話番号", get: (it) => txt(it.phone) },
    { label: "開店日", get: (it) => txt(it.open_date) },
    { label: "ランク", get: (it) => txt(it.rank) },
    { label: "日中12時間交通量", get: (it) => fmt(it.traffic_12h) },
    { label: "周辺充実度", get: (it) => fmt(it.surrounding_score) },
    { label: "通過速度", get: (it) => fmt(it.passing_speed) },
    { label: "角地", get: (it) => bool(it.corner_lot) },
    { label: "視認性", get: (it) => bool(it.visibility) },
    { label: "認知度", get: (it) => fmt(it.awareness) },
    { label: "世帯年収（万円）", get: (it) => fmt(it.household_income) },
    { label: "広さ（坪）", get: (it) => fmt(it.size_tsubo) },
    { label: "何台並べるか", get: (it) => fmt(it.car_capacity) },
    { label: "拭上げスペース数", get: (it) => fmt(it.wipe_spaces) },
    { label: "同心円1.0km人口", get: (it) => fmt(it.pop_1km) },
    { label: "同心円2.0km人口", get: (it) => fmt(it.pop_2km) },
    { label: "同心円5.0km人口", get: (it) => fmt(it.pop_5km) },
  ]
})()

// 選択した店舗を横並びの列で比較（ArmBox式）。左ドックに収め、横スクロール可。
function CompareTable({
  items,
  onRemove,
  onEdit,
}: {
  items: MapItem[]
  onRemove: (id: string) => void
  onEdit: (item: MapItem) => void
}) {
  return (
    <div className="overflow-auto flex-1">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 border-b border-r px-2 py-2 text-left w-24 min-w-24" />
            {items.map((it) => (
              <th
                key={it.id}
                className="border-b border-r px-2 py-2 text-left min-w-[130px] align-top"
                style={{ borderTop: `3px solid ${CATEGORY_COLORS[it.category]}` }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="font-bold text-gray-800 leading-tight text-[11px]">{it.name}</div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {it.kind === "store" && (
                      <button onClick={() => onEdit(it)} title="編集" className="text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => onRemove(it.id)} title="外す" className="text-gray-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr key={row.label}>
              <td className="sticky left-0 z-10 bg-gray-50 border-b border-r px-2 py-1 text-gray-500 whitespace-nowrap font-medium text-[10px]">
                {row.label}
              </td>
              {items.map((it) => (
                <td key={it.id} className="border-b border-r px-2 py-1 text-gray-800 break-words">
                  {row.get(it)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
