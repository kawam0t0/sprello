"use client"

import { useEffect, useMemo, useState } from "react"
import { X, ChevronDown, ChevronRight, ExternalLink, Check, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  fetchSupplies,
  getSupplyChecks,
  setSupplyChecked,
  type SupplyCategory,
} from "@/lib/pjt-supplies-operations"

export function SuppliesDialog({
  cardId,
  projectName,
  sheetUrl,
  open,
  onClose,
}: {
  cardId: string
  projectName: string
  sheetUrl: string
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [cats, setCats] = useState<SupplyCategory[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState("")
  const [onlyTodo, setOnlyTodo] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const [list, checks] = await Promise.all([fetchSupplies(sheetUrl), getSupplyChecks(cardId)])
        if (!alive) return
        if (!list.found) {
          setErr(list.message)
          setCats([])
        } else {
          setCats(list.categories)
        }
        setChecked(checks)
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "読み込みに失敗しました")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, sheetUrl, cardId])

  const toggle = async (key: string) => {
    const next = new Set(checked)
    const willCheck = !next.has(key)
    if (willCheck) next.add(key)
    else next.delete(key)
    setChecked(next) // 楽観的更新
    try {
      await setSupplyChecked(cardId, key, willCheck)
    } catch {
      // 失敗したら戻す
      const revert = new Set(next)
      if (willCheck) revert.delete(key)
      else revert.add(key)
      setChecked(revert)
      alert("保存に失敗しました。通信状況をご確認ください。")
    }
  }

  const overall = useMemo(() => {
    let done = 0
    let total = 0
    for (const c of cats)
      for (const it of c.items) {
        total++
        if (checked.has(it.key)) done++
      }
    return { done, total }
  }, [cats, checked])

  const kw = q.trim().toLowerCase()
  const visibleCats = useMemo(() => {
    return cats
      .map((c) => ({
        ...c,
        items: c.items.filter((it) => {
          if (kw && !it.name.toLowerCase().includes(kw)) return false
          if (onlyTodo && checked.has(it.key)) return false
          return true
        }),
      }))
      .filter((c) => c.items.length > 0)
  }, [cats, kw, onlyTodo, checked])

  if (!open) return null

  const pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-5 py-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">備品リスト</h2>
            <p className="text-xs text-gray-500">{projectName}</p>
          </div>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            元シート
          </a>
          <button onClick={onClose} className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 進捗＋検索 */}
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

        {/* 本体 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="p-10 text-center text-gray-400">読み込み中...</div>
          ) : err ? (
            <div className="m-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {err}
            </div>
          ) : (
            visibleCats.map((c) => {
              const done = c.items.filter((it) => checked.has(it.key)).length
              const isOpen = !collapsed[c.key]
              return (
                <div key={c.key} className="mb-3">
                  <button
                    onClick={() => setCollapsed((m) => ({ ...m, [c.key]: !m[c.key] }))}
                    className="w-full flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-bold text-gray-800">{c.title}</span>
                    <span className="ml-auto text-xs text-gray-500 tabular-nums">
                      {done}/{c.items.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-1 divide-y">
                      {c.items.map((it) => {
                        const on = checked.has(it.key)
                        return (
                          <div
                            key={it.key}
                            className={`flex items-center gap-2 px-2 py-1.5 ${on ? "bg-blue-50/40" : ""}`}
                          >
                            <button
                              onClick={() => toggle(it.key)}
                              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                on
                                  ? "bg-[#1b4da0] border-[#1b4da0] text-white"
                                  : "bg-white border-gray-300 hover:border-[#1b4da0]"
                              }`}
                            >
                              {on && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                it.kind === "指定"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {it.kind}
                            </span>
                            <span
                              className={`flex-1 text-sm truncate ${on ? "line-through text-gray-400" : "text-gray-800"}`}
                              title={it.name}
                            >
                              {it.name}
                            </span>
                            {it.qty && (
                              <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                                ×{it.qty}
                              </span>
                            )}
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
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
          {!loading && !err && visibleCats.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">該当する品目がありません</div>
          )}
        </div>
      </div>
    </div>
  )
}
