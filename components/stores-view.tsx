"use client"

import { useEffect, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStores, updateStore, deleteStore } from "@/lib/database-operations"
import { StoreForm } from "@/components/store-form"
import type { Store } from "@/types/database"

export function StoresView() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Store | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setStores(await getStores())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

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

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true)
      await deleteStore(id)
      await load()
      setConfirmId(null)
    } catch (e) {
      alert("削除に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"))
    } finally {
      setDeleting(false)
    }
  }

  const cell = (v: string | number | null | undefined) =>
    v == null || v === "" ? <span className="text-gray-300">—</span> : v

  const headers = [
    "コード",
    "店舗名",
    "ステータス",
    "ランク",
    "住所",
    "電話",
    "日中12h交通量",
    "世帯年収",
    "広さ(坪)",
    "1km人口",
    "操作",
  ]

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">店舗一覧表</h2>
        <span className="text-sm text-gray-500">{stores.length} 店舗</span>
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
              {stores.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{cell(s.store_code)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{cell(s.store_name)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{cell(s.status)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{cell(s.rank)}</td>
                  <td className="px-3 py-2 max-w-[240px] truncate" title={s.address ?? ""}>
                    {cell(s.address)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{cell(s.phone)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {s.traffic_12h != null ? s.traffic_12h.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {s.household_income != null ? `${s.household_income}万` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{cell(s.size_tsubo)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {s.pop_1km != null ? s.pop_1km.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {confirmId === s.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600">削除しますか？</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting}
                          onClick={() => handleDelete(s.id)}
                        >
                          {deleting ? "削除中…" : "削除する"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleting}
                          onClick={() => setConfirmId(null)}
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEdit(s)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          編集
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmId(s.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          削除
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-gray-400">
                    店舗がありません（stores テーブルを確認してください）
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
