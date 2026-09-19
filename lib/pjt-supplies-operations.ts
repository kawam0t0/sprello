import { supabase } from "./supabase"
import { PJT_SUPPLIES_TEMPLATE } from "./pjt-supplies-template"

export interface SupplyItem {
  id: string
  card_id: string
  category: string
  cat_title: string
  kind: string // 指定 / 推奨
  name: string
  url: string | null
  note: string | null
  qty: string | null
  checked: boolean
  position: number
}

export async function getSupplyItems(cardId: string): Promise<SupplyItem[]> {
  const { data, error } = await supabase
    .from("project_supply_items")
    .select("*")
    .eq("card_id", cardId)
    .order("position")
  if (error) {
    console.error("[getSupplyItems] error:", error)
    throw error
  }
  return (data as SupplyItem[]) ?? []
}

// 空ならテンプレートから一括作成（既存は触らない）。二重生成を直列化して防止。
const seedInFlight = new Map<string, Promise<SupplyItem[]>>()
export async function ensureSupplyItems(cardId: string): Promise<SupplyItem[]> {
  const rows = await getSupplyItems(cardId)
  if (rows.length > 0) return rows
  const running = seedInFlight.get(cardId)
  if (running) return running
  const p = (async () => {
    const seedRows: Record<string, unknown>[] = []
    let pos = 0
    for (const cat of PJT_SUPPLIES_TEMPLATE) {
      for (const it of cat.items) {
        seedRows.push({
          card_id: cardId,
          category: cat.key,
          cat_title: cat.title,
          kind: it.kind,
          name: it.name,
          url: it.url ?? null,
          note: it.note ?? null,
          qty: it.qty ?? "",
          checked: false,
          position: pos++,
        })
      }
    }
    const { error } = await supabase.from("project_supply_items").insert(seedRows)
    if (error) throw error
    return getSupplyItems(cardId)
  })().finally(() => seedInFlight.delete(cardId))
  seedInFlight.set(cardId, p)
  return p
}

export async function addSupplyItem(input: {
  card_id: string
  category: string
  cat_title: string
  kind: string
  name: string
  url?: string | null
  qty?: string | null
  position: number
}): Promise<SupplyItem> {
  const { data, error } = await supabase
    .from("project_supply_items")
    .insert({
      card_id: input.card_id,
      category: input.category,
      cat_title: input.cat_title,
      kind: input.kind,
      name: input.name,
      url: input.url ?? null,
      qty: input.qty ?? "",
      checked: false,
      position: input.position,
    })
    .select()
    .single()
  if (error) throw error
  return data as SupplyItem
}

export async function updateSupplyItem(
  id: string,
  patch: Partial<Pick<SupplyItem, "checked" | "name" | "qty" | "kind" | "url">>,
): Promise<void> {
  const { error } = await supabase
    .from("project_supply_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteSupplyItem(id: string): Promise<void> {
  const { error } = await supabase.from("project_supply_items").delete().eq("id", id)
  if (error) throw error
}
