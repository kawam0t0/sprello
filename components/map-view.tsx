"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Pencil, Menu } from "lucide-react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { CATEGORY_COLORS, PROJECT_CATEGORIES, STAGES, STAGE_COLORS, normalizeCategory, normalizeStage } from "@/types/database"
import type { Card, MapItem, ProjectCategory, Store } from "@/types/database"
import { BRAND_LOGOS } from "@/lib/brand-logos"
import { getStores, updateStore, geocodeAddress, fetchTraffic } from "@/lib/database-operations"
import { resolveLatLngFromUrl } from "@/lib/maps-url"
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

// 到達圏（アイソクロン）の色分け。地点ごとに色相を変え、各地点内は
// 時間が短い＝濃い / 長い＝淡い の3段階。地点が増えたら順に色を割り当てる。
type IsoBand = { min: number; color: string }
const ISO_PALETTES: { name: string; base: string; bands: IsoBand[] }[] = [
  { name: "青", base: "#1b4da0", bands: [{ min: 5, color: "#1b4da0" }, { min: 10, color: "#4b8fe3" }, { min: 15, color: "#a7c8f2" }] },
  { name: "オレンジ", base: "#c2410c", bands: [{ min: 5, color: "#c2410c" }, { min: 10, color: "#f97316" }, { min: 15, color: "#fdba74" }] },
  { name: "緑", base: "#15803d", bands: [{ min: 5, color: "#15803d" }, { min: 10, color: "#22c55e" }, { min: 15, color: "#86efac" }] },
  { name: "紫", base: "#6d28d9", bands: [{ min: 5, color: "#6d28d9" }, { min: 10, color: "#a855f7" }, { min: 15, color: "#d8b4fe" }] },
  { name: "ピンク", base: "#be185d", bands: [{ min: 5, color: "#be185d" }, { min: 10, color: "#ec4899" }, { min: 15, color: "#f9a8d4" }] },
  { name: "ティール", base: "#0f766e", bands: [{ min: 5, color: "#0f766e" }, { min: 10, color: "#14b8a6" }, { min: 15, color: "#5eead4" }] },
]
const ISO_MINUTES = [5, 10, 15]
const isoPalette = (i: number) => ISO_PALETTES[i % ISO_PALETTES.length]

type IsoPoint = {
  id: number
  lat: number
  lng: number
  geojson: any
  status: "loading" | "ready" | "error" | "nokey"
}

interface MapViewProps {
  cards: (Card & { listTitle?: string })[]
}

// 段階（OPEN/工事中/設営中/契約済/Aヨミ/Bヨミ/Cヨミ/Dヨミ）。自社店舗は常にOPEN扱い。
function stageOf(item: MapItem): { label: string; color: string } {
  const label = item.kind === "store" ? "OPEN" : normalizeStage(item.stage)
  return { label, color: STAGE_COLORS[label] ?? "#6b7280" }
}

function storeToItem(s: Store): MapItem | null {
  // 文字列で入っている場合も数値化。null/空/非数は座標なし扱い（住所からの補完対象）。
  const lat = s.latitude == null ? NaN : Number(s.latitude)
  const lng = s.longitude == null ? NaN : Number(s.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id: `store-${s.id}`,
    kind: "store",
    name: s.store_name,
    category: normalizeCategory(s.category),
    lat,
    lng,
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

  // 住所を「正」として座標を同期する（自己修復）。
  // 住所がある店舗は毎セッション1回ジオコーディングし、
  // 保存座標が無い/住所と大きくズレている場合は住所の座標で上書きする。
  // （＝店舗一覧表の住所どおりの位置にピンを立てる）
  const geocodedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const targets = stores.filter((s) => s.address && !geocodedRef.current.has(s.id))
    if (targets.length === 0) return
    let cancelled = false
    // 2点間の距離(m)。約40m以上ズレていたら上書きする。
    const distM = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const R = 6371000,
        toR = (d: number) => (d * Math.PI) / 180
      const dLat = toR(bLat - aLat),
        dLng = toR(bLng - aLng)
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2
      return 2 * R * Math.asin(Math.sqrt(x))
    }
    ;(async () => {
      let updated = false
      for (const s of targets) {
        geocodedRef.current.add(s.id)
        const geo = await geocodeAddress(s.address as string)
        if (cancelled) return
        if (geo.lat == null || geo.lng == null) continue
        const curLat = s.latitude == null ? NaN : Number(s.latitude)
        const curLng = s.longitude == null ? NaN : Number(s.longitude)
        const hasCur = Number.isFinite(curLat) && Number.isFinite(curLng)
        // 座標が無い、または住所の座標と40m以上ズレている場合のみ上書き
        if (!hasCur || distM(curLat, curLng, geo.lat, geo.lng) > 40) {
          try {
            await updateStore(s.id, { latitude: geo.lat, longitude: geo.lng })
            updated = true
          } catch (e) {
            console.warn("[map] 店舗座標の同期に失敗:", s.store_name, e)
          }
        }
      }
      if (!cancelled && updated) refreshStores()
    })()
    return () => {
      cancelled = true
    }
  }, [stores])

  const [visibleCats, setVisibleCats] = useState<Record<ProjectCategory, boolean>>({
    スプラッシュンゴー: true,
    "D-Splash": true,
    "丸紅-Splash": true,
  })
  const [activeRadii, setActiveRadii] = useState<Record<number, boolean>>({ 1: false, 2: false, 5: false })
  const [circleAll, setCircleAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [showYoto, setShowYoto] = useState(false)
  // 段階（ヨミ）で絞り込み。既定は全部表示。
  const [visibleStages, setVisibleStages] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STAGES.map((s) => [s, true])),
  )
  // 商圏2km（全店舗にデフォルト表示。2km圏が重なる＝薄い赤、重ならない＝薄い青）
  const [showTradeArea, setShowTradeArea] = useState(true)
  // 住所／GoogleマップURL 検索
  const [searchInput, setSearchInput] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchTarget, setSearchTarget] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [yotoLegend, setYotoLegend] = useState<{ counts: Record<string, number>; needZoom: boolean; noKey: boolean }>(
    { counts: {}, needZoom: false, noKey: false },
  )
  // 距離測定
  const [measuring, setMeasuring] = useState(false)
  const [measurePts, setMeasurePts] = useState<{ lat: number; lng: number }[]>([])
  // 到達圏（車でN分）。複数地点に対応し、地点ごとに色を変える。
  const [isoOn, setIsoOn] = useState(false)
  const [isoPoints, setIsoPoints] = useState<IsoPoint[]>([])
  const isoIdRef = useRef(0)

  const [editStore, setEditStore] = useState<Store | null>(null)
  const [saving, setSaving] = useState(false)

  const allItems = useMemo(() => {
    const s = stores.map(storeToItem).filter(Boolean) as MapItem[]
    // OPEN段階のプロジェクトは自社店舗(stores)へ同期済み（store_code=PJ-<cardId>）。
    // 二重ピンを避けるため、対応する店舗があるOPENプロジェクトは地図から除外。
    const storeCodes = new Set(stores.map((x) => x.store_code).filter(Boolean) as string[])
    const p = (cards.map(cardToItem).filter(Boolean) as MapItem[]).filter((it) => {
      if (stageOf(it).label !== "OPEN") return true
      const cardId = it.id.replace("project-", "")
      return !storeCodes.has(`PJ-${cardId}`)
    })
    return [...s, ...p]
  }, [stores, cards])

  const visibleItems = useMemo(
    () => allItems.filter((it) => visibleCats[it.category] && visibleStages[stageOf(it).label]),
    [allItems, visibleCats, visibleStages],
  )

  // 選択はIDで保持し、最新データから列を作る（比較用）
  const selectedItems = useMemo(
    () => selectedIds.map((id) => allItems.find((it) => it.id === id)).filter(Boolean) as MapItem[],
    [selectedIds, allItems],
  )
  const toggleSelect = (it: MapItem) =>
    setSelectedIds((prev) => (prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]))

  // 到達圏：地図クリックで地点を追加し、その地点のポリゴンを取得（複数地点対応）
  const addIsoPoint = async (lat: number, lng: number) => {
    const id = ++isoIdRef.current
    setIsoPoints((prev) => [...prev, { id, lat, lng, geojson: null, status: "loading" }])
    let status: IsoPoint["status"] = "error"
    let geojson: any = null
    try {
      const res = await fetch("/api/isochrone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, minutes: ISO_MINUTES }),
      })
      const j = await res.json().catch(() => null)
      if (j?.error === "NO_KEY") status = "nokey"
      else if (j && !j.error && j.geojson?.features?.length) {
        status = "ready"
        geojson = j.geojson
      }
    } catch {
      status = "error"
    }
    setIsoPoints((prev) => prev.map((p) => (p.id === id ? { ...p, status, geojson } : p)))
  }
  const removeIsoPoint = (id: number) => setIsoPoints((prev) => prev.filter((p) => p.id !== id))
  const clearIsoPoints = () => setIsoPoints([])

  // 住所／GoogleマップURL 検索 → ピンを立てて地図を移動
  const runSearch = async () => {
    const q = searchInput.trim()
    if (!q) return
    setSearching(true)
    try {
      let pt: { lat: number; lng: number } | null = null
      if (/https?:\/\//i.test(q)) {
        pt = await resolveLatLngFromUrl(q)
        if (!pt) {
          const g = await geocodeAddress(q)
          if (g.lat != null && g.lng != null) pt = { lat: g.lat, lng: g.lng }
        }
      } else {
        const g = await geocodeAddress(q)
        if (g.lat != null && g.lng != null) pt = { lat: g.lat, lng: g.lng }
      }
      if (pt) setSearchTarget({ ...pt, label: q })
      else alert("場所を特定できませんでした。住所またはGoogleマップのURLをご確認ください。")
    } finally {
      setSearching(false)
    }
  }

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
            <TradeAreaLayer items={visibleItems} enabled={showTradeArea} />
            <MapOverlays
              items={visibleItems}
              enabledRadii={enabledRadii}
              circleAll={circleAll}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
            <YotoLayer enabled={showYoto} onLegend={setYotoLegend} />
            <SpotInfoLayer enabled={!measuring && !isoOn} />
            <MeasureLayer
              measuring={measuring}
              points={measurePts}
              onAdd={(pt) => setMeasurePts((p) => [...p, pt])}
            />
            <IsochroneLayer enabled={isoOn} points={isoPoints} onPick={addIsoPoint} />
            <SearchLayer target={searchTarget} />
          </Map>
        </APIProvider>

        {/* 住所・GoogleマップURL 検索（測定中は隠す） */}
        {!measuring && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 rounded-lg shadow-xl border px-2 py-1.5 w-[min(420px,78vw)]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch()
              }}
              placeholder="住所 または GoogleマップのURL を入力"
              className="flex-1 text-sm px-2 py-1 outline-none bg-transparent"
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="text-xs bg-[#1b4da0] hover:bg-[#163f85] text-white px-3 py-1.5 rounded whitespace-nowrap disabled:opacity-60"
            >
              {searching ? "検索中…" : "検索"}
            </button>
            {searchTarget && (
              <button
                onClick={() => {
                  setSearchTarget(null)
                  setSearchInput("")
                }}
                title="検索ピンを消す"
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 商圏2kmの凡例（表示ON時） */}
        {showTradeArea && (
          <div className="absolute bottom-3 right-3 z-10 bg-white/95 rounded-lg shadow-xl border px-3 py-2">
            <div className="text-[11px] font-bold text-gray-700 mb-1">商圏2km</div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#ef4444", opacity: 0.35 }} />
              <span>重複あり（NG）</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#3b82f6", opacity: 0.35 }} />
              <span>重複なし</span>
            </div>
          </div>
        )}

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

        {/* 面積/距離 測定パネル（測定中 or 計測点がある時） */}
        {(measuring || measurePts.length > 0) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 rounded-lg shadow-xl border px-4 py-2 flex items-center gap-4">
            {measurePts.length >= 3 ? (
              <>
                <div>
                  <div className="text-[10px] text-gray-500 leading-none">面積</div>
                  <div className="text-lg font-bold text-gray-800 leading-tight">
                    {(polygonAreaM2(measurePts) / SQM_PER_TSUBO).toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    坪
                  </div>
                  <div className="text-[11px] text-gray-500 leading-tight">
                    {Math.round(polygonAreaM2(measurePts)).toLocaleString()} ㎡
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 leading-none">周囲</div>
                  <div className="text-sm font-semibold text-gray-700 leading-tight">
                    {formatDist(perimeterM(measurePts))}
                  </div>
                </div>
              </>
            ) : measurePts.length === 2 ? (
              <div>
                <div className="text-[10px] text-gray-500 leading-none">距離</div>
                <div className="text-lg font-bold text-gray-800 leading-tight">
                  {formatDist(totalDistance(measurePts))}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 leading-tight">
                地図をクリックして頂点を追加（3点以上で面積、2点で距離）
              </div>
            )}
            <div className="text-[11px] text-gray-400 max-w-[150px] leading-tight">
              {measuring ? "クリックで頂点を追加。囲むと自動で閉じます。" : "再開は「距離を測定」をON。"}
            </div>
            <button
              onClick={() => setMeasurePts([])}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            >
              クリア
            </button>
            <button
              onClick={() => {
                setMeasuring(false)
                setMeasurePts([])
              }}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 到達圏パネル（表示ON時） */}
        {isoOn && (
          <div className="absolute top-3 left-16 z-10 bg-white/95 rounded-lg shadow-xl border p-3 w-60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">到達圏（車）</span>
              <button
                onClick={() => {
                  setIsoOn(false)
                  clearIsoPoints()
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {isoPoints.some((p) => p.status === "nokey") ? (
              <p className="text-[11px] text-rose-500 leading-snug">
                OPENROUTESERVICE_API_KEY が未設定です。OpenRouteService の無料APIキーを環境変数に設定してください。
              </p>
            ) : (
              <>
                {/* 時間帯の凡例（濃いほど短時間） */}
                <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2">
                  <span>近い</span>
                  <span className="inline-block h-2.5 flex-1 rounded-sm" style={{ background: "linear-gradient(90deg,#1b4da0,#4b8fe3,#a7c8f2)" }} />
                  <span>遠い（15分）</span>
                </div>

                {isoPoints.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-snug">
                    地図上の地点をクリックすると、その場所から車で到達できる範囲を表示します。複数クリックすると地点ごとに色が変わります。
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[40vh] overflow-auto">
                    {isoPoints.map((p, idx) => {
                      const pal = isoPalette(idx)
                      return (
                        <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                            style={{ backgroundColor: pal.base }}
                          />
                          <span className="flex-1 leading-tight">
                            地点 {idx + 1}
                            {p.status === "loading" && <span className="text-gray-400">（計算中…）</span>}
                            {p.status === "error" && <span className="text-rose-400">（取得失敗）</span>}
                          </span>
                          <button
                            onClick={() => removeIsoPoint(p.id)}
                            title="この地点を消す"
                            className="text-gray-400 hover:text-red-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isoPoints.length > 0 && (
                  <button
                    onClick={clearIsoPoints}
                    className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded w-full"
                  >
                    すべてクリア
                  </button>
                )}
              </>
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

              <div className="border-t pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">段階で絞り込み</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setVisibleStages(Object.fromEntries(STAGES.map((s) => [s, true])))}
                      className="text-[10px] text-[#1b4da0] hover:underline"
                    >
                      全表示
                    </button>
                    <span className="text-gray-300">/</span>
                    <button
                      onClick={() => setVisibleStages(Object.fromEntries(STAGES.map((s) => [s, false])))}
                      className="text-[10px] text-gray-500 hover:underline"
                    >
                      全解除
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {STAGES.map((st) => {
                    const count = allItems.filter((it) => stageOf(it).label === st).length
                    return (
                      <label key={st} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={visibleStages[st]}
                          onChange={(e) => setVisibleStages((p) => ({ ...p, [st]: e.target.checked }))}
                        />
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STAGE_COLORS[st] }}
                        />
                        <span className="flex-1 leading-tight">{st}</span>
                        <span className="text-gray-400">{count}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="border-t pt-2">
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
                  <input
                    type="checkbox"
                    checked={showTradeArea}
                    onChange={(e) => setShowTradeArea(e.target.checked)}
                  />
                  商圏2km（重複＝薄い赤／単独＝薄い青）
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm mt-2">
                  <input type="checkbox" checked={showYoto} onChange={(e) => setShowYoto(e.target.checked)} />
                  用途地域を表示
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm mt-2 pt-2 border-t">
                  <input
                    type="checkbox"
                    checked={measuring}
                    onChange={(e) => {
                      setMeasuring(e.target.checked)
                      if (e.target.checked) {
                        setFilterOpen(false)
                        setIsoOn(false)
                        clearIsoPoints()
                      }
                    }}
                  />
                  距離・面積を測定
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm mt-2 pt-2 border-t">
                  <input
                    type="checkbox"
                    checked={isoOn}
                    onChange={(e) => {
                      const on = e.target.checked
                      setIsoOn(on)
                      if (on) {
                        setFilterOpen(false)
                        setMeasuring(false)
                        setMeasurePts([])
                      } else {
                        clearIsoPoints()
                      }
                    }}
                  />
                  到達圏（車で5・10・15分）
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

// ピンクリック時のポップアップ内容（主要指標をパッと表示）
function infoHtml(it: MapItem): string {
  const st = stageOf(it)
  const brand = it.brand || it.category || ""
  const num = (v: number | null | undefined, unit = "") =>
    v == null ? "—" : Number(v).toLocaleString() + unit
  const rows: [string, string][] = [
    ["ランク", it.rank || "—"],
    ["日中12h交通量", num(it.traffic_12h, " 台")],
    ["世帯年収", num(it.household_income, " 万円")],
    ["周辺充実度", it.surrounding_score == null ? "—" : String(it.surrounding_score)],
    ["通過速度", it.passing_speed == null ? "—" : String(it.passing_speed)],
    ["広さ", num(it.size_tsubo, " 坪")],
    [
      "商圏人口 1/2/5km",
      [it.pop_1km, it.pop_2km, it.pop_5km].map((p) => (p == null ? "—" : Number(p).toLocaleString())).join(" / "),
    ],
  ]
  const rowsHtml = rows
    .map(
      ([l, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#888">${l}</span><span style="font-weight:600;color:#222">${escapeXml(v)}</span></div>`,
    )
    .join("")
  return (
    `<div style="font-size:12px;line-height:1.7;min-width:190px;max-width:240px">` +
    `<div style="font-weight:700;font-size:13px;color:#111">${escapeXml(it.name)}</div>` +
    `<div style="margin:2px 0 6px"><span style="background:${st.color};color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px">${escapeXml(st.label)}</span> <span style="color:#555;font-size:11px">${escapeXml(brand)}</span></div>` +
    rowsHtml +
    (it.address ? `<div style="color:#888;font-size:11px;margin-top:4px">${escapeXml(it.address)}</div>` : "") +
    `</div>`
  )
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
    const info = new google.maps.InfoWindow()

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
      // クリックで主要指標のポップアップ（交通量・世帯年収・商圏人口など）を表示
      marker.addListener("click", () => {
        const node = document.createElement("div")
        node.innerHTML = infoHtml(it)
        const btn = document.createElement("button")
        const isSel = selectedIds.includes(it.id)
        btn.textContent = isSel ? "比較から外す" : "比較に追加"
        btn.style.cssText =
          "margin-top:8px;width:100%;padding:5px 8px;border-radius:6px;border:1px solid #1b4da0;background:" +
          (isSel ? "#fff" : "#1b4da0") +
          ";color:" +
          (isSel ? "#1b4da0" : "#fff") +
          ";font-size:12px;font-weight:600;cursor:pointer"
        btn.addEventListener("click", () => {
          onSelect(it)
          info.close()
        })
        node.appendChild(btn)
        info.setContent(node)
        info.open({ map, anchor: marker })
      })
      markersRef.current.push(marker)
    })

    return () => {
      info.close()
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

// ---- 地点クリックでその場の指標（交通量・市区町村の年収）をポップアップ ----
function SpotInfoLayer({ enabled }: { enabled: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!map || typeof google === "undefined" || !enabled) return
    const info = new google.maps.InfoWindow()

    const l = map.addListener("click", async (ev: any) => {
      if (!ev.latLng) return
      const lat = ev.latLng.lat()
      const lng = ev.latLng.lng()
      info.setContent('<div style="font-size:12px;padding:2px 4px">読み込み中…</div>')
      info.setPosition({ lat, lng })
      info.open({ map })

      const [t, m] = await Promise.all([
        fetchTraffic(lat, lng),
        fetch(`/api/revgeo?lat=${lat}&lng=${lng}`)
          .then((r) => r.json())
          .catch(() => null),
      ])

      const area = (m && (m.city || m.town)) || "この地点"
      const traffic =
        t && "found" in t && t.found
          ? `${t.traffic_12h.toLocaleString()} 台 <span style="color:#888">（最寄り${t.road_class}・約${(t.distance_m / 1000).toFixed(1)}km）</span>`
          : "近くに調査区間なし"
      const income =
        m && m.income_household != null
          ? `${Number(m.income_household).toLocaleString()} 万円 <span style="color:#888">（推計）</span>`
          : "データ未取得"

      info.setContent(
        `<div style="font-size:12px;line-height:1.7;min-width:210px;max-width:260px">` +
          `<div style="font-weight:700;font-size:13px;color:#111">${escapeXml(String(area))} 付近</div>` +
          `<div style="margin-top:4px;display:flex;justify-content:space-between;gap:10px"><span style="color:#888">日中12h交通量</span><span style="font-weight:600;color:#222">${traffic}</span></div>` +
          `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#888">推計世帯年収</span><span style="font-weight:600;color:#222">${income}</span></div>` +
          `<div style="color:#aaa;font-size:10px;margin-top:5px">概算（交通量=センサスR3／世帯年収=市区町村の課税所得からの推計）</div>` +
          `</div>`,
      )
    })

    return () => {
      google.maps.event.removeListener(l)
      info.close()
    }
  }, [map, enabled])

  return null
}

// ---- 到達圏（アイソクロン）オーバーレイ ----
// GeoJSON の Polygon / MultiPolygon を google.maps.Polygon 用の paths（緯度経度リング）に変換。
function geometryToPaths(geom: any): { lat: number; lng: number }[][] {
  const toRing = (ring: any[]) =>
    ring.map((c: any[]) => ({ lat: Number(c[1]), lng: Number(c[0]) }))
  if (!geom) return []
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
    return geom.coordinates.map(toRing)
  }
  if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    const paths: { lat: number; lng: number }[][] = []
    geom.coordinates.forEach((poly: any[]) => poly.forEach((ring: any[]) => paths.push(toRing(ring))))
    return paths
  }
  return []
}

function IsochroneLayer({
  enabled,
  points,
  onPick,
}: {
  enabled: boolean
  points: IsoPoint[]
  onPick: (lat: number, lng: number) => void
}) {
  const map = useMap()

  // 到達圏モード中は地図クリックで地点を追加
  useEffect(() => {
    if (!map || typeof google === "undefined" || !enabled) return
    const l = map.addListener("click", (ev: any) => {
      if (ev.latLng) onPick(ev.latLng.lat(), ev.latLng.lng())
    })
    return () => google.maps.event.removeListener(l)
  }, [map, enabled, onPick])

  // 全地点のポリゴン＋起点マーカーを描画（地点ごとに色を変える）
  useEffect(() => {
    if (!map || typeof google === "undefined") return
    const shapes: google.maps.Polygon[] = []
    const markers: google.maps.Marker[] = []

    points.forEach((pt, idx) => {
      const pal = isoPalette(idx)
      const feats: any[] = pt.geojson?.features ? [...pt.geojson.features] : []
      // 面積が大きい（＝時間が長い）ものから先に描画し、短い時間ほど上に重ねる
      feats.sort((a, b) => (b?.properties?.value ?? 0) - (a?.properties?.value ?? 0))
      feats.forEach((f) => {
        const sec = Number(f?.properties?.value ?? 0)
        const min = Math.round(sec / 60)
        const band = pal.bands.find((b) => b.min === min) ?? pal.bands[pal.bands.length - 1]
        const paths = geometryToPaths(f?.geometry)
        if (!paths.length) return
        shapes.push(
          new google.maps.Polygon({
            map,
            paths,
            strokeColor: band.color,
            strokeOpacity: 0.9,
            strokeWeight: 1.5,
            fillColor: band.color,
            fillOpacity: 0.28,
            clickable: false,
            zIndex: 100 - min, // 短時間ほど手前
          }),
        )
      })

      // 起点マーカー（その地点の色）
      markers.push(
        new google.maps.Marker({
          map,
          position: { lat: pt.lat, lng: pt.lng },
          zIndex: 1000,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: pal.base,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          label: { text: String(idx + 1), color: "#fff", fontSize: "10px", fontWeight: "700" },
        }),
      )
    })

    return () => {
      shapes.forEach((s) => s.setMap(null))
      markers.forEach((m) => m.setMap(null))
    }
  }, [map, points])

  return null
}

// ---- 商圏2kmオーバーレイ（2km圏が重なる＝薄い赤／重ならない＝薄い青） ----
function TradeAreaLayer({ items, enabled }: { items: MapItem[]; enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!map || typeof google === "undefined" || !enabled) return
    const R = 2000 // 2km
    // 2つの円が重なる ⇔ 中心間距離 < 2R
    const overlap = items.map((it, i) =>
      items.some(
        (o, j) => j !== i && haversineM({ lat: it.lat, lng: it.lng }, { lat: o.lat, lng: o.lng }) < 2 * R,
      ),
    )
    const circles = items.map((it, i) => {
      const ng = overlap[i]
      return new google.maps.Circle({
        map,
        center: { lat: it.lat, lng: it.lng },
        radius: R,
        clickable: false,
        strokeColor: ng ? "#dc2626" : "#2563eb",
        strokeOpacity: 0.55,
        strokeWeight: 1,
        fillColor: ng ? "#ef4444" : "#3b82f6",
        fillOpacity: 0.1,
        zIndex: 1,
      })
    })
    return () => circles.forEach((c) => c.setMap(null))
  }, [map, items, enabled])
  return null
}

// ---- 住所／GoogleマップURL 検索のピン ----
function SearchLayer({ target }: { target: { lat: number; lng: number; label: string } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || typeof google === "undefined" || !target) return
    map.panTo({ lat: target.lat, lng: target.lng })
    map.setZoom(15)
    const marker = new google.maps.Marker({
      map,
      position: { lat: target.lat, lng: target.lng },
      zIndex: 2000,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#dc2626",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
    })
    const info = new google.maps.InfoWindow({
      content: `<div style="font-size:12px;max-width:220px">検索地点<br><span style="color:#666">${escapeXml(
        target.label,
      )}</span></div>`,
    })
    info.open({ map, anchor: marker })
    return () => {
      info.close()
      marker.setMap(null)
    }
  }, [map, target])
  return null
}

// ---- 距離測定 ----
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000,
    toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat),
    dLng = toR(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
function totalDistance(pts: { lat: number; lng: number }[]): number {
  let d = 0
  for (let i = 0; i + 1 < pts.length; i++) d += haversineM(pts[i], pts[i + 1])
  return d
}
// 閉じた図形の周囲長（頂点3つ以上なら最後→最初の辺も加える）
function perimeterM(pts: { lat: number; lng: number }[]): number {
  let d = totalDistance(pts)
  if (pts.length >= 3) d += haversineM(pts[pts.length - 1], pts[0])
  return d
}
// ポリゴン面積(㎡)。局所的な正距円筒投影＋シューレース公式（小面積で十分正確）
function polygonAreaM2(pts: { lat: number; lng: number }[]): number {
  if (pts.length < 3) return 0
  const latRef = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * (Math.PI / 180)
  const mLat = 111320
  const mLng = 111320 * Math.cos(latRef)
  const xy = pts.map((p) => [p.lng * mLng, p.lat * mLat])
  let a = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}
const SQM_PER_TSUBO = 3.305785 // 1坪 = 400/121 ㎡
function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

function MeasureLayer({
  measuring,
  points,
  onAdd,
}: {
  measuring: boolean
  points: { lat: number; lng: number }[]
  onAdd: (pt: { lat: number; lng: number }) => void
}) {
  const map = useMap()

  // 図形（3点以上は自動で閉じるポリゴン、2点以下は線）＋頂点マーカーの描画
  useEffect(() => {
    if (!map || typeof google === "undefined") return
    const overlays: (google.maps.Polygon | google.maps.Polyline)[] = []
    if (points.length >= 3) {
      overlays.push(
        new google.maps.Polygon({
          map,
          paths: points,
          strokeColor: "#1b4da0",
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor: "#1b4da0",
          fillOpacity: 0.15,
        }),
      )
    } else if (points.length >= 2) {
      overlays.push(
        new google.maps.Polyline({
          map,
          path: points,
          strokeColor: "#1b4da0",
          strokeWeight: 3,
          strokeOpacity: 0.95,
        }),
      )
    }
    const dots = points.map(
      (p) =>
        new google.maps.Marker({
          map,
          position: p,
          zIndex: 1000,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: "#fff",
            fillOpacity: 1,
            strokeColor: "#1b4da0",
            strokeWeight: 2,
          },
        }),
    )
    return () => {
      overlays.forEach((o) => o.setMap(null))
      dots.forEach((d) => d.setMap(null))
    }
  }, [map, points])

  // 測定中は地図クリックで点を追加
  useEffect(() => {
    if (!map || typeof google === "undefined" || !measuring) return
    const l = map.addListener("click", (ev: any) => {
      if (ev.latLng) onAdd({ lat: ev.latLng.lat(), lng: ev.latLng.lng() })
    })
    return () => google.maps.event.removeListener(l)
  }, [map, measuring, onAdd])

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
