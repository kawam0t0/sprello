"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Pencil, Menu } from "lucide-react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { CATEGORY_COLORS, PROJECT_CATEGORIES, normalizeCategory } from "@/types/database"
import type { Card, MapItem, ProjectCategory, Store } from "@/types/database"
import { BRAND_LOGOS } from "@/lib/brand-logos"
import { getStores, updateStore } from "@/lib/database-operations"
import { StoreForm } from "@/components/store-form"

const DEFAULT_CENTER = { lat: 36.3912, lng: 139.0608 }
const RADII: { km: number; label: string }[] = [
  { km: 1, label: "1km" },
  { km: 2, label: "2km" },
  { km: 5, label: "5km" },
]

// 用途地域の表示色（use_area_ja でマッピング）。都市計画の慣例配色に準拠。
const YOTO_ORDER = [
  "第一種低層住居専用地域",
  "第二種低層住居専用地域",
  "第一種中高層住居専用地域",
  "第二種中高層住居専用地域",
  "第一種住居地域",
  "第二種住居地域",
  "準住居地域",
  "田園住居地域",
  "近隣商業地域",
  "商業地域",
  "準工業地域",
  "工業地域",
  "工業専用地域",
]
const YOTO_COLORS: Record<string, string> = {
  第一種低層住居専用地域: "#4CAF7D",
  第二種低層住居専用地域: "#78C08A",
  第一種中高層住居専用地域: "#9CCC9E",
  第二種中高層住居専用地域: "#C6E08A",
  第一種住居地域: "#F5E27A",
  第二種住居地域: "#F7EBB0",
  準住居地域: "#F3C36B",
  田園住居地域: "#A9D18E",
  近隣商業地域: "#F3A98E",
  商業地域: "#EC7FB0",
  準工業地域: "#B9A6D6",
  工業地域: "#A9C4E0",
  工業専用地域: "#7FB2D9",
}
const YOTO_FALLBACK = "#cccccc"

interface MapViewProps {
  cards: (Card & { listTitle?: string })[]
}

// ステージ（OPEN/Aヨミ/Bヨミ/Cヨミ/未確定）の色分け
const STAGE_COLORS: Record<string, string> = {
  OPEN: "#16a34a",
  Aヨミ: "#2563eb",
  Bヨミ: "#d97706",
  Cヨミ: "#ea580c",
  未確定: "#6b7280",
  その他: "#6b7280",
}
function stageOf(item: MapItem): { label: string; color: string } {
  if (item.kind === "store") return { label: "OPEN", color: STAGE_COLORS.OPEN }
  const t = item.stage || ""
  if (t.includes("完了")) return { label: "OPEN", color: STAGE_COLORS.OPEN }
  if (t.includes("Aヨミ")) return { label: "Aヨミ", color: STAGE_COLORS.Aヨミ }
  if (t.includes("Bヨミ")) return { label: "Bヨミ", color: STAGE_COLORS.Bヨミ }
  if (t.includes("Cヨミ")) return { label: "Cヨミ", color: STAGE_COLORS.Cヨミ }
  if (t.includes("未確定")) return { label: "未確定", color: STAGE_COLORS.未確定 }
  return { label: t || "—", color: STAGE_COLORS.その他 }
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

function cardToItem(c: Card & { listTitle?: string }): MapItem | null {
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return null
  return {
    id: `project-${c.id}`,
    kind: "project",
    name: c.store_name || c.title,
    category: normalizeCategory(c.category),
    stage: c.listTitle ?? null,
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
  const [showYoto, setShowYoto] = useState(false)
  const [yotoLegend, setYotoLegend] = useState<{ counts: Record<string, number>; needZoom: boolean; noKey: boolean }>(
    { counts: {}, needZoom: false, noKey: false },
  )

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
            <YotoLayer enabled={showYoto} onLegend={setYotoLegend} />
          </Map>
        </APIProvider>

        {/* 用途地域の凡例（表示ON時のみ） */}
        {showYoto && (
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 rounded-lg shadow-xl border p-3 max-h-[46vh] overflow-auto w-52">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">用途地域</span>
              <button onClick={() => setShowYoto(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {yotoLegend.noKey ? (
              <p className="text-[11px] text-rose-500 leading-snug">
                REINFOLIB_API_KEY が未設定です。不動産情報ライブラリのAPIキーを環境変数に設定してください。
              </p>
            ) : yotoLegend.needZoom ? (
              <p className="text-[11px] text-gray-500 leading-snug">もう少し地図をズームインすると表示されます。</p>
            ) : (
              <div className="space-y-1">
                {YOTO_ORDER.filter((n) => (yotoLegend.counts[n] ?? 0) > 0).map((n) => (
                  <div key={n} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="inline-block w-3 h-3 rounded-sm border border-black/10 flex-shrink-0"
                      style={{ backgroundColor: YOTO_COLORS[n] }}
                    />
                    <span className="flex-1 leading-tight">{n}</span>
                    <span className="text-gray-400">{yotoLegend.counts[n]}</span>
                  </div>
                ))}
                {Object.keys(yotoLegend.counts).length === 0 && (
                  <p className="text-[11px] text-gray-400">この範囲に用途地域データがありません。</p>
                )}
              </div>
            )}
          </div>
        )}

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

              <div className="border-t pt-2">
                <div className="text-xs font-semibold text-gray-500 mb-2">地図レイヤ</div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={showYoto} onChange={(e) => setShowYoto(e.target.checked)} />
                  用途地域を表示
                </label>
                <div className="text-[10px] text-gray-400 mt-1">出典：国交省 不動産情報ライブラリ（要APIキー）</div>
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

function buildPin(
  name: string,
  brandColor: string,
  stageLabel: string,
  stageColor: string,
  selected: boolean,
  logo: string,
): { url: string; w: number; h: number } {
  const logoS = 22 // ブランドロゴ（左端）
  const logoX = 6
  const logoY = 4
  const chipTextW = stageLabel.length * 11 + 12 // ステージ文字（OPEN/Aヨミ等）
  const chipX = logoX + logoS + 6
  const chipW = chipTextW
  const nameX = chipX + chipW + 7
  const nameW = Math.max(name.length * 13, 16)
  const w = Math.ceil(nameX + nameW + 10)
  const h = 40
  const stroke = selected ? "#111827" : brandColor
  const sw = selected ? 3 : 2
  const cx = w / 2
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs><clipPath id='lc'><rect x='${logoX}' y='${logoY}' width='${logoS}' height='${logoS}' rx='5'/></clipPath></defs>` +
    `<rect x='1.5' y='1.5' rx='14' ry='14' width='${w - 3}' height='28' fill='white' stroke='${stroke}' stroke-width='${sw}'/>` +
    // ブランドロゴ
    `<image x='${logoX}' y='${logoY}' width='${logoS}' height='${logoS}' xlink:href='${logo}' clip-path='url(#lc)' preserveAspectRatio='xMidYMid meet'/>` +
    `<rect x='${logoX}' y='${logoY}' width='${logoS}' height='${logoS}' rx='5' fill='none' stroke='#e5e7eb' stroke-width='1'/>` +
    // ステージチップ
    `<rect x='${chipX}' y='5' rx='6' ry='6' width='${chipW}' height='19' fill='${stageColor}'/>` +
    `<text x='${chipX + chipW / 2}' y='18.5' text-anchor='middle' font-family='sans-serif' font-size='11' font-weight='700' fill='white'>${escapeXml(stageLabel)}</text>` +
    // 店名
    `<text x='${nameX}' y='19' font-family='sans-serif' font-size='13' font-weight='700' fill='#1f2937'>${escapeXml(name)}</text>` +
    // 吹き出し（ブランド色枠）
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
      const st = stageOf(it)
      const pin = buildPin(shortName(it.name), color, st.label, st.color, selected, BRAND_LOGOS[it.category])
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

// ---- 用途地域オーバーレイ（不動産情報ライブラリ XKT002 タイル） ----
function YotoLayer({
  enabled,
  onLegend,
}: {
  enabled: boolean
  onLegend: (v: { counts: Record<string, number>; needZoom: boolean; noKey: boolean }) => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || typeof google === "undefined" || !enabled) return

    const data = new google.maps.Data()
    const info = new google.maps.InfoWindow()
    data.setStyle((f) => {
      const name = (f.getProperty("use_area_ja") as string) || ""
      const c = YOTO_COLORS[name] || YOTO_FALLBACK
      return {
        fillColor: c,
        fillOpacity: 0.35,
        strokeColor: c,
        strokeOpacity: 0.75,
        strokeWeight: 0.6,
        clickable: true,
      }
    })
    data.setMap(map)

    const clickL = data.addListener("click", (ev: any) => {
      const f = ev.feature
      const name = f.getProperty("use_area_ja") ?? "—"
      const bcr = f.getProperty("u_building_coverage_ratio_ja") ?? "—"
      const far = f.getProperty("u_floor_area_ratio_ja") ?? "—"
      const city = f.getProperty("city_name") ?? ""
      info.setContent(
        `<div style="font-size:12px;line-height:1.5"><b>${name}</b><br>建蔽率 ${bcr} ／ 容積率 ${far}<br><span style="color:#888">${city}</span></div>`,
      )
      info.setPosition(ev.latLng)
      info.open({ map })
    })

    const loaded = new Set<string>()
    let curZ: number | null = null

    const tileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z)
    const tileY = (lat: number, z: number) => {
      const r = (lat * Math.PI) / 180
      return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
    }
    const clearAll = () => {
      data.forEach((f) => data.remove(f))
      loaded.clear()
    }
    const countByType = () => {
      const c: Record<string, number> = {}
      data.forEach((f) => {
        const n = (f.getProperty("use_area_ja") as string) || "不明"
        c[n] = (c[n] || 0) + 1
      })
      return c
    }

    const refresh = async () => {
      const zoom = map.getZoom() ?? 0
      if (zoom < 11) {
        clearAll()
        curZ = null
        onLegend({ counts: {}, needZoom: true, noKey: false })
        return
      }
      const z = Math.min(15, Math.max(11, Math.round(zoom)))
      if (z !== curZ) {
        clearAll()
        curZ = z
      }
      const b = map.getBounds()
      if (!b) return
      const ne = b.getNorthEast()
      const sw = b.getSouthWest()
      const x0 = tileX(sw.lng(), z),
        x1 = tileX(ne.lng(), z)
      const y0 = tileY(ne.lat(), z),
        y1 = tileY(sw.lat(), z)
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 60) {
        onLegend({ counts: countByType(), needZoom: true, noKey: false })
        return
      }
      let sawNoKey = false
      const jobs: Promise<void>[] = []
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${z}/${x}/${y}`
          if (loaded.has(key)) continue
          loaded.add(key)
          jobs.push(
            fetch(`/api/youto?z=${z}&x=${x}&y=${y}`)
              .then((r) => r.json())
              .then((j) => {
                if (j && j.error) {
                  if (j.error === "NO_KEY") sawNoKey = true
                  return
                }
                if (j && j.type && Array.isArray(j.features)) {
                  try {
                    data.addGeoJson(j)
                  } catch {
                    /* 幾何が空などは無視 */
                  }
                }
              })
              .catch(() => {}),
          )
        }
      }
      await Promise.all(jobs)
      onLegend({ counts: countByType(), needZoom: false, noKey: sawNoKey })
    }

    const idleL = map.addListener("idle", refresh)
    refresh()

    return () => {
      google.maps.event.removeListener(idleL)
      google.maps.event.removeListener(clickL)
      info.close()
      data.setMap(null)
    }
  }, [map, enabled, onLegend])

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
