import { supabase } from "./supabase"
import type { Card, Store } from "@/types/database"

// 自社店舗マスターを取得
export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase.from("stores").select("*").order("store_code")
  if (error) {
    console.error("[getStores] error:", error)
    return []
  }
  return (data as Store[]) ?? []
}

// 自社店舗を更新
export async function updateStore(id: string, updates: Partial<Store>): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
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
// まずブラウザ側（地図と同じリファラー許可済みキー）で変換し、
// 失敗したときだけサーバーAPIにフォールバックする。失敗しても null を返す。
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number | null; lng: number | null }> {
  if (!address?.trim()) return { lat: null, lng: null }

  // 1) ブラウザ側のGeocoder（追加キー不要）
  if (typeof window !== "undefined") {
    try {
      const { loadGoogleMaps } = await import("./google-maps-loader")
      const g = await loadGoogleMaps()
      const geocoder = new g.maps.Geocoder()
      const result = await geocoder.geocode({ address, region: "jp" })
      const loc = result?.results?.[0]?.geometry?.location
      if (loc) {
        return { lat: loc.lat(), lng: loc.lng() }
      }
    } catch (e) {
      console.warn("[geocode] client-side失敗、サーバーにフォールバック:", e)
    }
  }

  // 2) サーバーAPIフォールバック（GOOGLE_MAPS_API_KEY使用）
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
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
  // 住所があればジオコーディングして緯度経度を補完
  let lat = fields.lat ?? null
  let lng = fields.lng ?? null
  if ((lat == null || lng == null) && fields.address) {
    const geo = await geocodeAddress(fields.address)
    lat = geo.lat
    lng = geo.lng
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
      pop_1km: fields.pop_1km ?? null,
      pop_2km: fields.pop_2km ?? null,
      pop_5km: fields.pop_5km ?? null,
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
