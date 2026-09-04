"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStores, updateStore, deleteStore, deleteCard } from "@/lib/database-operations"
import { StoreForm } from "@/components/store-form"
import { STAGE_COLORS, normalizeStage } from "@/types/database"
import type { Card, Store } from "@/types/database"

type Row = {
  key: string
  kind: "store" | "project"
  store?: Store
  card?: Card & { listTitle?: string }
  cardId?: string
  code: string
  name: string
  stage: string
  address: string | null
  candidate_url?: string | null
  phone?: string | null
  traffic_12h?: number | null
  household_income?: number | null
  size_tsubo?: number | null
  pop_1km?: number | null
}

// 全プロジェクト（段階問わず）＋自社店舗を一覧表示する。
export function StoresView({
  cards = [],
  onRefetch,
  onEditCard,
}: {
  cards?: (Card & { listTitle?: string })[]
  onRefetch?: () => void
  onEditCard?: (card: Card & { listTitle?: string }) => void
}) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Store | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setStores(await getStores())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const rows = useMemo<Row[]>(() => {
    const storeCodes = new Set(stores.map((s) => s.store_code).filter(Boolean) as string[])
    const storeRows: Row[] = stores.map((s) => ({
      key: `store-${s.id}`,
      kind: "store",
      store: s,
      code: s.store_code ?? "",
      name: s.store_name,
      stage: "OPEN",
      address: s.address ?? null,
      phone: s.phone ?? null,
      traffic_12h: s.traffic_12h ?? null,
      household_income: s.household_income ?? null,
      size_tsubo: s.size_tsubo ?? null,
      pop_1km: s.pop_1km ?? null,
    }))
    // OPEN連携済みのカード(PJ-)は店舗側で表示するため除外
    const cardRows: Row[] = cards
      .filter((c) => !storeCodes.has(`PJ-${c.id}`))
      .map((c) => ({
        key: `card-${c.id}`,
        kind: "project",
        card: c,
        cardId: c.id,
        code: c.property_no ?? "",
        name: c.store_name || c.title,
        stage: normalizeStage(c.listTitle),
        address: c.address ?? null,
        candidate_url: c.candidate_url ?? null,
        traffic_12h: c.traffic_12h ?? null,
        household_income: c.household_income ?? null,
        size_tsubo: c.size_tsubo ?? null,
        pop_1km: c.pop_1km ?? null,
      }))
    // OPEN → その他段階の順で
    const order = ["OPEN", "工事中", "契約済", "Aヨミ", "Bヨミ", "Cヨミ"]
    return [...storeRows, ...cardRows].sort(
      (a, b) => order.indexOf(a.stage) - order.indexOf(b.stage),
    )
  }, [stores, cards])

  const handleSave = async (id: string, patch: Partial<Store>) => {
    try {
      setSaving(true)
      await updateStore(id, patch)
      await load()
      setEdit(null)
    } catch (e) {
      alert("保存に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: Row) => {
    try {
      setDeleting(true)
      if (row.kind === "store" && row.store) {
        await deleteStore(row.store.id)
        await load()
      } else if (row.kind === "project" && row.cardId) {
        await deleteCard(row.cardId)
        onRefetch?.()
      }
      setConfirmKey(null)
    } catch (e) {
      alert("削除に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"))
    } finally {
      setDeleting(false)
    }
  }

  const num = (v: number | null | undefined) =>
    v == null ? <span className="text-gray-300">—</span> : v.toLocaleString()

  const headers = ["段階", "店舗/プロジェクト名", "住所 / 候補地URL", "日中12h交通量", "世帯年収", "広さ(坪)", "1km人口", "操作"]

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">店舗一覧表</h2>
        <span className="text-sm text-gray-500">{rows.length} 件</span>
      </div>

      {loading ? (
        <div className="text-gray-500 p-8 text-center">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="inline-block text-white text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[r.stage] ?? "#6b7280" }}
                    >
                      {r.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 max-w-[280px] truncate" title={r.address ?? r.candidate_url ?? ""}>
                    {r.address ? (
                      r.address
                    ) : r.candidate_url ? (
                      <a
                        href={r.candidate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        候補地URL
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{num(r.traffic_12h)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {r.household_income != null ? `${r.household_income}万` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{num(r.size_tsubo)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{num(r.pop_1km)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {confirmKey === r.key ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600">削除しますか？</span>
                        <Button size="sm" variant="destructive" disabled={deleting} onClick={() => handleDelete(r)}>
                          {deleting ? "削除中…" : "削除する"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={deleting} onClick={() => setConfirmKey(null)}>
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {r.kind === "store" && r.store && (
                          <Button size="sm" variant="outline" onClick={() => setEdit(r.store!)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            編集
                          </Button>
                        )}
                        {r.kind === "project" && r.card && onEditCard && (
                          <Button size="sm" variant="outline" onClick={() => onEditCard(r.card!)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            編集
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmKey(r.key)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          削除
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-gray-400">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <StoreForm
        store={edit}
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        onSubmit={handleSave}
        submitting={saving}
      />
    </div>
  )
}
