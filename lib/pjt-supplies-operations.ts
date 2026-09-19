import { supabase } from "./supabase"

export type SupplyItem = {
  key: string
  kind: string // 指定 / 推奨
  name: string
  url: string | null
  note: string | null
  qty: string
}
export type SupplyCategory = { key: string; title: string; items: SupplyItem[] }

// スプレッドシートから備品リストを取得（A〜Dのカテゴリ・品目）
export async function fetchSupplies(
  sheetUrl: string,
): Promise<{ found: true; categories: SupplyCategory[]; total: number } | { found: false; message: string }> {
  const res = await fetch(`/api/supplies?url=${encodeURIComponent(sheetUrl)}`)
  const data = await res.json()
  if (data.error) return { found: false, message: data.error }
  return data
}

// この店舗(card)でチェック済みの item_key 一覧
export async function getSupplyChecks(cardId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("project_supplies")
    .select("item_key, checked")
    .eq("card_id", cardId)
    .eq("checked", true)
  if (error) {
    console.error("[getSupplyChecks] error:", error)
    throw error
  }
  return new Set((data ?? []).map((r: { item_key: string }) => r.item_key))
}

// チェックの保存（card_id × item_key で upsert）
export async function setSupplyChecked(
  cardId: string,
  itemKey: string,
  checked: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("project_supplies")
    .upsert(
      { card_id: cardId, item_key: itemKey, checked, updated_at: new Date().toISOString() },
      { onConflict: "card_id,item_key" },
    )
  if (error) throw error
}
