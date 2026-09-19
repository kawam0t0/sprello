"use client"

import { useEffect, useMemo, useState } from "react"
import { X, ChevronDown, ChevronRight, ExternalLink, Check, Search, Trash2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  getSupplyItems,
  ensureSupplyItems,
  addSupplyItem,
  updateSupplyItem,
  deleteSupplyItem,
  type SupplyItem,
} from "@/lib/pjt-supplies-operations"

type Group = { key: string; title: string; items: SupplyItem[] }

export function SuppliesDialog({
  cardId,
  projectName,
  open,
  onClose,
}: {
  cardId: string
  projectName: string
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<SupplyItem[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState("")
  const [onlyTodo, setOnlyTodo] = useState(false)
  const [addingCat, setAddingCat] = useState<string | null>(null)
  const [addName, setAddName] = useState("")
  const [addQty, setAddQty] = useState("")
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const rows = await ensureSupplyItems(cardId)
        if (alive) setItems(rows)
      } catch (e) {
        if (alive)
          setErr(
            (e instanceof Error ? e.message : "読み込みに失敗しました") +
              "（Supabaseで scripts/12-project-supplies.sql を実行しましたか？）",
          )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, cardId])

  const reload = async () => {
    try {
      setItems(await getSupplyItems(cardId))
    } catch {
      /* noop */
    }
  }

  const toggle = async (it: SupplyItem) => {
    const v = !it.checked
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, checked: v } : x)))
    try {
      await updateSupplyItem(it.id, { checked: v })
    } catch {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, checked: !v } : x)))
    }
  }

  const remove = async (id: string) => {
    setConfirmDel(null)
    setItems((prev) => prev.filter((x) => x.id !== id))
    try {
      await deleteSupplyItem(id)
    } catch {
      reload()
    }
  }

  const add = async (g: Group) => {
    const name = addName.trim()
    if (!name) {
      setAddingCat(null)
      setAddName("")
      setAddQty("")
      return
    }
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0
    setAddingCat(null)
    setAddName("")
    setAddQty("")
    try {
      await addSupplyItem({
        card_id: cardId,
        category: g.key,
        cat_title: g.title,
        kind: "推奨",
        name,
        qty: addQty.trim(),
        position,
      })
      reload()
    } catch {
      reload()
    }
  }

  // カテゴリごとにまとめる（テンプレの並び順を尊重）
  const groups = useMemo<Group[]>(() => {
    const order: string[] = []
    const map: Record<string, Group> = {}
    for (const it of items) {
      const k = it.cat_title || it.category || "その他"
      if (!map[k]) {
        map[k] = { key: it.category || k, title: k, items: [] }
        order.push(k)
      }
      map[k].items.push(it)
    }
    return order.map((k) => map[k])
  }, [items])

  const overall = useMemo(() => {
    const total = items.length
    const done = items.filter((i) => i.checked).length
    return { done, total }
  }, [items])

  const kw = q.trim().toLowerCase()
  const shownGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (kw && !it.name.toLowerCase().includes(kw)) return false
          if (onlyTodo && it.checked) return false
          return true
        }),
      }))
      .filter((g) => g.items.length > 0 || addingCat === g.key)
  }, [groups, kw, onlyTodo, addingCat])

  if (!open) return null
  const pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">備品リスト</h2>
            <p className="text-xs text-gray-500">{projectName}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#1b4da0] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {overall.done}/{overall.total}（{pct}%）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="品目を検索"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} />
              未購入のみ表示
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="p-10 text-center text-gray-400">読み込み中...</div>
          ) : err ? (
            <div className="m-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
          ) : (
            shownGroups.map((g) => {
              const gDone = g.items.filter((it) => it.checked).length
              const isOpen = !collapsed[g.title]
              return (
                <div key={g.title} className="mb-3">
                  <button
                    onClick={() => setCollapsed((m) => ({ ...m, [g.title]: !m[g.title] }))}
                    className="w-full flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-bold text-gray-800">{g.title}</span>
                    <span className="ml-auto text-xs text-gray-500 tabular-nums">
                      {gDone}/{g.items.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-1 divide-y">
                      {g.items.map((it) => {
                        const on = it.checked
                        return (
                          <div key={it.id} className={`group flex items-center gap-2 px-2 py-1.5 ${on ? "bg-blue-50/40" : ""}`}>
                            <button
                              onClick={() => toggle(it)}
                              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                on ? "bg-[#1b4da0] border-[#1b4da0] text-white" : "bg-white border-gray-300 hover:border-[#1b4da0]"
                              }`}
                            >
                              {on && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                it.kind === "指定" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {it.kind}
                            </span>
                            <span className={`flex-1 text-sm truncate ${on ? "line-through text-gray-400" : "text-gray-800"}`} title={it.name}>
                              {it.name}
                            </span>
                            {it.qty && <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">×{it.qty}</span>}
                            {it.url ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 flex-shrink-0 p-1"
                                title="購入リンクを開く"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : it.note ? (
                              <span className="text-xs text-gray-400 flex-shrink-0">{it.note}</span>
                            ) : null}
                            {confirmDel === it.id ? (
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => remove(it.id)} className="text-xs text-red-600 font-medium px-1">
                                  削除
                                </button>
                                <button onClick={() => setConfirmDel(null)} className="text-xs text-gray-400 px-1">
                                  取消
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDel(it.id)}
                                className="p-1 rounded text-gray-300 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {/* 品目を追加 */}
                      {addingCat === g.key ? (
                        <div className="flex items-center gap-2 px-2 py-2">
                          <Input
                            autoFocus
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") add(g)
                              if (e.key === "Escape") {
                                setAddingCat(null)
                                setAddName("")
                                setAddQty("")
                              }
                            }}
                            placeholder="品目名"
                            className="h-8 text-sm flex-1"
                          />
                          <Input
                            value={addQty}
                            onChange={(e) => setAddQty(e.target.value)}
                            placeholder="数量"
                            className="h-8 text-sm w-16"
                          />
                          <Button size="sm" className="h-8 bg-[#1b4da0] hover:bg-[#163f85]" onClick={() => add(g)}>
                            追加
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingCat(g.key)
                            setAddName("")
                            setAddQty("")
                          }}
                          className="flex items-center gap-1 text-xs text-[#1b4da0] hover:bg-blue-50 rounded px-2 py-1.5 mt-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> 品目を追加
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
          {!loading && !err && shownGroups.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">該当する品目がありません</div>
          )}
        </div>
      </div>
    </div>
  )
}
