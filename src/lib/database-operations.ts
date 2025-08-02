import { supabase } from "./supabase"
import type { Card } from "@/types/database"

// カードを作成
export async function createCard(listId: string, title: string, position: number): Promise<Card> {
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
