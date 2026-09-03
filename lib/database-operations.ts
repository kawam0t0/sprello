import { supabase } from "./supabase"
import type { Card, Store } from "@/types/database"
import { resolveLatLngFromUrl } from "./maps-url"

// 自社店舗マスターを取得
export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase.from("stores").select("*").order("store_code")
  if (error) {
    console.error("[getStores] error:", error)
    return []
  }
  return (data as Store[]) ?? []
}

// メッシュ人口(国勢2020)から半径1/2/5km圏の人口を取得
export async function fetchPopulation(
  lat: number,
  lng: number,
): Promise<{ pop_1km: number; pop_2km: number; pop_5km: number } | null> {
  try {
    const res = await fetch(`/api/population?lat=${lat}&lng=${lng}`)
    const data = await res.json()
    if (data.error || data.pop_5km == null) {
      console.warn("[fetchPopulation]", data.error)
      return null
    }
    return { pop_1km: data.pop_1km, pop_2km: data.pop_2km, pop_5km: data.pop_5km }
  } catch (e) {
    console.error("[fetchPopulation] error:", e)
    return null
  }
}

// 道路交通センサス(令和3年度)から最寄り調査区間の昼間12時間交通量を取得
export async function fetchTraffic(
  lat: number,
  lng: number,
): Promise<
  | {
      found: true
      traffic_12h: number
      traffic_up?: number | null
      traffic_down?: number | null
      traffic_12h_all?: number
      vehicle?: string
      distance_m: number
      road_class: string
      lanes: number | null
    }
  | { found: false; message: string }
  | null
> {
  try {
    const res = await fetch(`/api/traffic?lat=${lat}&lng=${lng}`)
    const data = await res.json()
    if (data.error) {
      console.warn("[fetchTraffic]", data.error)
      return null
    }
    if (data.found) {
      return {
        found: true,
        traffic_12h: data.traffic_12h,
        traffic_up: data.traffic_up ?? null,
        traffic_down: data.traffic_down ?? null,
        traffic_12h_all: data.traffic_12h_all,
        vehicle: data.vehicle,
        distance_m: data.distance_m,
        road_class: data.road_class,
        lanes: data.lanes ?? null,
      }
    }
    return { found: false, message: data.message ?? "見つかりませんでした" }
  } catch (e) {
    console.error("[fetchTraffic] error:", e)
    return null
  }
}

// Googleスプレッドシート「本部使用【候補地スペック】」から候補地スペックを取得
export async function fetchSheetSpec(
  url: string,
): Promise<
  | {
      found: true
      values: {
        store_name: string | null
        size_tsubo: number | null
        traffic_12h: number | null
        household_income: number | null
        passing_speed: number | null
        surrounding_score: number | null
      }
      filled: string[]
    }
  | { found: false; message: string }
  | null
> {
  try {
    const res = await fetch(`/api/sheet-spec?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    if (data.error) {
      return { found: false, message: data.error }
    }
    if (data.found) {
      return { found: true, values: data.values, filled: data.filled }
    }
    return { found: false, message: data.message ?? "取得できませんでした" }
  } catch (e) {
    console.error("[fetchSheetSpec] error:", e)
    return null
  }
}

// 完了したプロジェクト(カード)を自社店舗(stores)へ反映（store_codeで重複防止のupsert）
export async function upsertStoreFromCard(card: Card): Promise<void> {
  const code = `PJ-${card.id}`
  const { error } = await supabase.from("stores").upsert(
    {
      store_code: code,
      store_name: card.store_name || card.title,
      brand: card.brand ?? "",
      category: card.category ?? "スプラッシュンゴー",
      address: card.address ?? "",
      candidate_url: card.candidate_url ?? null,
      latitude: card.lat ?? null,
      longitude: card.lng ?? null,
      location_type: card.location_type ?? null,
      prefecture: card.prefecture ?? null,
      open_date: card.open_date ?? null,
      rank: card.rank ?? null,
      status: "オープン",
      traffic_12h: card.traffic_12h ?? null,
      surrounding_score: card.surrounding_score ?? null,
      passing_speed: card.passing_speed ?? null,
      corner_lot: card.corner_lot ?? null,
      visibility: card.visibility ?? null,
      awareness: card.awareness ?? null,
      household_income: card.household_income ?? null,
      size_tsubo: card.size_tsubo ?? null,
      car_capacity: card.car_capacity ?? null,
      wipe_spaces: card.wipe_spaces ?? null,
      pop_1km: card.pop_1km ?? null,
      pop_2km: card.pop_2km ?? null,
      pop_5km: card.pop_5km ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_code" },
  )
  if (error) throw error
}

// 自社店舗を更新
export async function updateStore(id: string, updates: Partial<Store>): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

// 店舗を1件削除（店舗一覧表の削除ボタンから使用）
export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from("stores").delete().eq("id", id)
  if (error) throw error
}

// 図面ファイルを Supabase Storage(バケット drawings) にアップロードし公開URLを返す
export async function uploadDrawing(
  cardId: string,
  file: File,
): Promise<{ name: string; url: string }> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${cardId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from("drawings").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from("drawings").getPublicUrl(path)
  return { name: file.name, url: data.publicUrl }
}

async function createTrelloListForCard(projectName: string, cardData: any) {
  try {
    console.log("[v0] Creating Trello list for:", projectName)
    
    const response = await fetch("/api/trello/create-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, cardData }),
    })

    console.log("[v0] Response status:", response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Trello API error response:", errorData)
      throw new Error(`Failed to create Trello list: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    console.log("[v0] Trello list created successfully:", result)
    return result
  } catch (error) {
    console.error("[v0] Trello integration error:", error)
    throw error
  }
}

// カードを作成
export async function createCard(listId: string, title: string, position: number): Promise<Card> {
  const trelloData = await createTrelloListForCard(title, {})

  const { data, error } = await supabase
    .from("cards")
    .insert({
      list_id: listId,
      title,
      position,
      status: "",
      memo: "",
      candidate_url: "",
      candidate_url2: "",
      company_name: "",
      company_url: "",
      trello_list_id: trelloData?.trelloListId || null,
      trello_card_id: trelloData?.trelloCardId || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Card
}

// 住所から緯度経度を取得。
// 日本の住所に強く、APIキー不要の「国土地理院 住所検索API」を最優先で使う
// （GoogleキーのGeocoding API未許可(REQUEST_DENIED)問題を回避）。
// 取れないときだけ Google（ブラウザ→サーバー）にフォールバック。失敗しても null を返す。
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number | null; lng: number | null }> {
  if (!address?.trim()) return { lat: null, lng: null }

  // 全角数字・各種ハイフンを半角に正規化（例: 「３−１」→「3-1」）
  const q = address
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[−–—―ー－]/g, "-")
    .trim()

  // 1) 国土地理院 住所検索API（無料・キー不要・番地レベルまで対応）
  try {
    const res = await fetch(
      "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(q),
    )
    if (res.ok) {
      const arr = await res.json()
      const c = Array.isArray(arr) && arr[0]?.geometry?.coordinates
      if (Array.isArray(c) && c.length >= 2) {
        const lng = Number(c[0]),
          lat = Number(c[1])
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
      }
    }
  } catch (e) {
    console.warn("[geocode] GSI失敗、Googleにフォールバック:", e)
  }

  // 2) ブラウザ側のGoogle Geocoder（フォールバック）
  if (typeof window !== "undefined") {
    try {
      const { loadGoogleMaps } = await import("./google-maps-loader")
      const g = await loadGoogleMaps()
      const geocoder = new g.maps.Geocoder()
      const result = await geocoder.geocode({ address: q, region: "jp" })
      const loc = result?.results?.[0]?.geometry?.location
      if (loc) {
        return { lat: loc.lat(), lng: loc.lng() }
      }
    } catch (e) {
      console.warn("[geocode] client-side失敗、サーバーにフォールバック:", e)
    }
  }

  // 3) サーバーAPIフォールバック
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: q }),
    })
    const data = await res.json()
    return { lat: data.lat ?? null, lng: data.lng ?? null }
  } catch (e) {
    console.error("[geocode] error:", e)
    return { lat: null, lng: null }
  }
}

// 新規プロジェクト（＝ArmBox項目付きカード）を作成
// Trello連携はベストエフォート（失敗してもプロジェクト作成は継続）
export async function createProject(
  listId: string,
  fields: Partial<Card> & { title: string },
  position: number,
): Promise<Card> {
  // ピン座標の決定：候補地URL（GoogleマップURL）を最優先。無ければ住所からジオコーディング。
  let lat = fields.lat ?? null
  let lng = fields.lng ?? null
  if (lat == null || lng == null) {
    if (fields.candidate_url) {
      const r = await resolveLatLngFromUrl(fields.candidate_url)
      if (r) {
        lat = r.lat
        lng = r.lng
      }
    }
    if ((lat == null || lng == null) && fields.address) {
      const geo = await geocodeAddress(fields.address)
      lat = geo.lat
      lng = geo.lng
    }
  }

  // 商圏人口の自動入力（座標が取れて、人口が未入力のときだけ）
  let pop_1km = fields.pop_1km ?? null
  let pop_2km = fields.pop_2km ?? null
  let pop_5km = fields.pop_5km ?? null
  if (lat != null && lng != null && pop_1km == null) {
    const pop = await fetchPopulation(lat, lng)
    if (pop) {
      pop_1km = pop.pop_1km
      pop_2km = pop.pop_2km
      pop_5km = pop.pop_5km
    }
  }

  // Trelloリスト作成（失敗は握りつぶす）
  let trelloData: any = null
  try {
    const response = await fetch("/api/trello/create-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: fields.title, cardData: {} }),
    })
    if (response.ok) trelloData = await response.json()
  } catch (e) {
    console.warn("[createProject] Trello連携スキップ:", e)
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      list_id: listId,
      position,
      status: fields.status ?? "",
      memo: fields.memo ?? "",
      open_date: fields.open_date ?? null,
      start_date: fields.start_date ?? null,
      candidate_url: fields.candidate_url ?? "",
      candidate_url2: fields.candidate_url2 ?? "",
      company_name: fields.company_name ?? "",
      company_url: fields.company_url ?? "",
      // ArmBox項目
      title: fields.title,
      category: fields.category ?? "スプラッシュンゴー",
      district: fields.district ?? "",
      property_no: fields.property_no ?? "",
      brand: fields.brand ?? "",
      store_name: fields.store_name ?? "",
      location_type: fields.location_type ?? "",
      prefecture: fields.prefecture ?? "",
      address: fields.address ?? "",
      rank: fields.rank ?? "",
      traffic_12h: fields.traffic_12h ?? null,
      surrounding_score: fields.surrounding_score ?? null,
      passing_speed: fields.passing_speed ?? null,
      corner_lot: fields.corner_lot ?? false,
      visibility: fields.visibility ?? false,
      awareness: fields.awareness ?? null,
      household_income: fields.household_income ?? null,
      size_tsubo: fields.size_tsubo ?? null,
      car_capacity: fields.car_capacity ?? null,
      wipe_spaces: fields.wipe_spaces ?? null,
      pop_1km,
      pop_2km,
      pop_5km,
      lat,
      lng,
      trello_list_id: trelloData?.trelloListId || null,
      trello_card_id: trelloData?.trelloCardId || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Card
}

// カードを更新
export async function updateCard(id: string, updates: Partial<Card>): Promise<Card> {
  const { data, error } = await supabase
    .from("cards")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Card
}

// カードを削除
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from("cards").delete().eq("id", id)

  if (error) throw error
}

// カードの位置を更新（ドラッグ&ドロップ用）
export async function moveCard(cardId: string, newListId: string, newPosition: number): Promise<void> {
  const { error } = await supabase
    .from("cards")
    .update({
      list_id: newListId,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)

  if (error) throw error
}

// カードの順序を入れ替え
export async function swapCards(card1Id: string, card2Id: string): Promise<void> {
  const { error } = await supabase.rpc("swap_card_positions", {
    card1_id: card1Id,
    card2_id: card2Id,
  })

  if (error) throw error
}

// リスト内のカード数を取得
export async function getCardCount(listId: string): Promise<number> {
  const { count, error } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId)

  if (error) throw error
  return count || 0
}
