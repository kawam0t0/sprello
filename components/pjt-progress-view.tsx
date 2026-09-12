"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  StickyNote,
  Check,
  Minus,
  ListChecks,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { STAGE_COLORS, normalizeStage } from "@/types/database"
import type { Card } from "@/types/database"
import {
  getProjectTodos,
  seedProjectTodos,
  addTodo,
  updateTodo,
  setCheckedMany,
  deleteTodo,
  type ProjectTodo,
} from "@/lib/pjt-todo-operations"
import { PJT_ASSIGNEES } from "@/lib/pjt-todo-template"

// このビューに出す対象段階（契約済以降）
const TARGET_STAGES = ["契約済", "工事中", "OPEN"] as const
const STAGE_ORDER: Record<string, number> = { 契約済: 0, 工事中: 1, OPEN: 2 }
const LEVEL_LABEL = ["", "大項目", "中項目", "小項目"]

type CardWithList = Card & { listTitle?: string }

export function PjtProgressView({ cards = [] }: { cards?: CardWithList[] }) {
  // 対象プロジェクト（契約済 / 工事中 / OPEN）
  const projects = useMemo(() => {
    return cards
      .map((c) => ({ card: c, stage: normalizeStage(c.listTitle) }))
      .filter((p) => (TARGET_STAGES as readonly string[]).includes(p.stage))
      .sort((a, b) => {
        const s = (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9)
        if (s !== 0) return s
        const ao = a.card.open_date ? new Date(a.card.open_date).getTime() : Infinity
        const bo = b.card.open_date ? new Date(b.card.open_date).getTime() : Infinity
        return ao - bo
      })
  }, [cards])

  const [stageFilter, setStageFilter] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const shownProjects = projects.filter((p) => stageFilter === "all" || p.stage === stageFilter)

  // 初期選択
  useEffect(() => {
    if (!selectedId && projects.length > 0) setSelectedId(projects[0].card.id)
  }, [projects, selectedId])

  const selected = projects.find((p) => p.card.id === selectedId) ?? null

  return (
    <div className="flex-1 min-h-0 flex bg-gray-50">
      {/* 左：対象プロジェクト一覧 */}
      <aside className="w-72 flex-shrink-0 border-r bg-white flex flex-col min-h-0">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-5 h-5 text-[#1b4da0]" />
            <h2 className="font-bold text-gray-800">PJT進捗</h2>
            <span className="ml-auto text-xs text-gray-400">{projects.length}件</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {["all", ...TARGET_STAGES].map((s) => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-2 py-0.5 rounded-full text-xs border ${
                  stageFilter === s
                    ? "bg-[#1b4da0] text-white border-[#1b4da0]"
                    : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {s === "all" ? "全て" : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {shownProjects.length === 0 && (
            <div className="p-4 text-sm text-gray-400">対象のプロジェクトがありません</div>
          )}
          {shownProjects.map((p) => (
            <ProjectRow
              key={p.card.id}
              name={p.card.store_name || p.card.title}
              stage={p.stage}
              active={p.card.id === selectedId}
              onClick={() => setSelectedId(p.card.id)}
            />
          ))}
        </div>
      </aside>

      {/* 右：選択プロジェクトのTODO */}
      <section className="flex-1 min-h-0 overflow-y-auto">
        {selected ? (
          <TodoPanel
            key={selected.card.id}
            cardId={selected.card.id}
            name={selected.card.store_name || selected.card.title}
            stage={selected.stage}
          />
        ) : (
          <div className="p-10 text-center text-gray-400">左からプロジェクトを選択してください</div>
        )}
      </section>
    </div>
  )
}

function ProjectRow({
  name,
  stage,
  active,
  onClick,
}: {
  name: string
  stage: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b flex items-center gap-2 hover:bg-blue-50 ${
        active ? "bg-blue-50 border-l-4 border-l-[#1b4da0]" : "border-l-4 border-l-transparent"
      }`}
    >
      <span
        className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: STAGE_COLORS[stage] ?? "#6b7280" }}
      >
        {stage}
      </span>
      <span className="text-sm text-gray-800 truncate">{name}</span>
    </button>
  )
}

// ---- 選択プロジェクトのTODOツリー ----
function TodoPanel({ cardId, name, stage }: { cardId: string; name: string; stage: string }) {
  const [todos, setTodos] = useState<ProjectTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [memoOpen, setMemoOpen] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingParent, setAddingParent] = useState<string | null>(null) // parent id or "root"
  const [addingText, setAddingText] = useState("")
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      let rows = await getProjectTodos(cardId)
      if (rows.length === 0) {
        rows = await seedProjectTodos(cardId)
      }
      setTodos(rows)
      // 大項目は初期展開
      const exp: Record<string, boolean> = {}
      rows.filter((r) => r.level === 1).forEach((r) => (exp[r.id] = true))
      setExpanded((prev) => ({ ...exp, ...prev }))
    } catch (e) {
      setErr(
        (e instanceof Error ? e.message : "読み込みに失敗しました") +
          "（Supabaseで scripts/11-pjt-todo.sql を実行しましたか？）",
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  // 親→子のマップ
  const kids = useMemo(() => {
    const m: Record<string, ProjectTodo[]> = {}
    for (const t of todos) {
      const k = t.parent_id ?? "root"
      ;(m[k] ||= []).push(t)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.position - b.position)
    return m
  }, [todos])

  // 葉ベースの進捗（子がなければ自分が葉）
  const leafStats = (id: string): { done: number; total: number } => {
    const children = kids[id] ?? []
    if (children.length === 0) {
      const self = todos.find((t) => t.id === id)
      return { done: self?.checked ? 1 : 0, total: 1 }
    }
    return children.reduce(
      (acc, c) => {
        const s = leafStats(c.id)
        return { done: acc.done + s.done, total: acc.total + s.total }
      },
      { done: 0, total: 0 },
    )
  }

  const overall = useMemo(() => {
    const roots = kids["root"] ?? []
    return roots.reduce(
      (acc, r) => {
        const s = leafStats(r.id)
        return { done: acc.done + s.done, total: acc.total + s.total }
      },
      { done: 0, total: 0 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, kids])

  // チェック切替：対象と子孫を value に、その後すべての親を「子が全部チェックか」で再計算
  const toggleCheck = async (id: string, value: boolean) => {
    const next = todos.map((t) => ({ ...t }))
    const byId = new Map(next.map((t) => [t.id, t]))
    const childMap: Record<string, ProjectTodo[]> = {}
    for (const t of next) (childMap[t.parent_id ?? "root"] ||= []).push(t)

    const setSub = (nid: string, v: boolean) => {
      const node = byId.get(nid)
      if (node) node.checked = v
      for (const c of childMap[nid] ?? []) setSub(c.id, v)
    }
    setSub(id, value)

    const recompute = (nid: string): boolean => {
      const children = childMap[nid] ?? []
      if (children.length === 0) return byId.get(nid)!.checked
      let all = true
      for (const c of children) if (!recompute(c.id)) all = false
      byId.get(nid)!.checked = all
      return all
    }
    for (const r of childMap["root"] ?? []) recompute(r.id)

    // 差分を抽出して永続化
    const changedTrue: string[] = []
    const changedFalse: string[] = []
    const prevById = new Map(todos.map((t) => [t.id, t]))
    for (const t of next) {
      if (prevById.get(t.id)?.checked !== t.checked) {
        ;(t.checked ? changedTrue : changedFalse).push(t.id)
      }
    }
    setTodos(next) // 楽観的更新
    try {
      if (changedTrue.length) await setCheckedMany(changedTrue, true)
      if (changedFalse.length) await setCheckedMany(changedFalse, false)
    } catch {
      load() // 失敗したら取り直し
    }
  }

  const onEditTitle = async (id: string, title: string) => {
    setEditingId(null)
    const t = todos.find((x) => x.id === id)
    if (!t || t.title === title) return
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, title } : x)))
    try {
      await updateTodo(id, { title })
    } catch {
      load()
    }
  }

  const onEditAssignee = async (id: string, assignee: string | null) => {
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, assignee } : x)))
    try {
      await updateTodo(id, { assignee })
    } catch {
      load()
    }
  }

  const onEditMemo = async (id: string, memo: string) => {
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, memo } : x)))
    try {
      await updateTodo(id, { memo })
    } catch {
      load()
    }
  }

  const onAdd = async (parentId: string | null, level: number) => {
    const text = addingText.trim()
    if (!text) {
      setAddingParent(null)
      setAddingText("")
      return
    }
    const siblings = kids[parentId ?? "root"] ?? []
    const position = siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0
    setAddingParent(null)
    setAddingText("")
    try {
      await addTodo({ card_id: cardId, parent_id: parentId, level, title: text, position })
      if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }))
      const rows = await getProjectTodos(cardId)
      setTodos(rows)
    } catch {
      load()
    }
  }

  const onDelete = async (id: string) => {
    setConfirmDel(null)
    setTodos((prev) => prev.filter((x) => x.id !== id && x.parent_id !== id))
    try {
      await deleteTodo(id)
      const rows = await getProjectTodos(cardId)
      setTodos(rows)
    } catch {
      load()
    }
  }

  if (loading) return <div className="p-10 text-center text-gray-400">読み込み中...</div>

  const pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-white text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: STAGE_COLORS[stage] ?? "#6b7280" }}
          >
            {stage}
          </span>
          <h2 className="text-xl font-bold text-gray-800">{name}</h2>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            <button
              className="text-xs text-gray-500 hover:text-gray-800 underline"
              onClick={() => {
                const allExpanded = (kids["root"] ?? []).every((r) => expanded[r.id])
                const nx: Record<string, boolean> = {}
                todos.forEach((t) => (nx[t.id] = !allExpanded))
                setExpanded(nx)
              }}
            >
              全て開閉
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#1b4da0] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">
            {overall.done}/{overall.total}（{pct}%）
          </span>
        </div>
      </div>

      {err && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
      )}

      {/* ツリー */}
      <div className="space-y-1">
        {(kids["root"] ?? []).map((node) => (
          <TodoNode
            key={node.id}
            node={node}
            kids={kids}
            expanded={expanded}
            setExpanded={setExpanded}
            memoOpen={memoOpen}
            setMemoOpen={setMemoOpen}
            editingId={editingId}
            setEditingId={setEditingId}
            onEditTitle={onEditTitle}
            onEditAssignee={onEditAssignee}
            onEditMemo={onEditMemo}
            toggleCheck={toggleCheck}
            leafStats={leafStats}
            addingParent={addingParent}
            setAddingParent={setAddingParent}
            addingText={addingText}
            setAddingText={setAddingText}
            onAdd={onAdd}
            confirmDel={confirmDel}
            setConfirmDel={setConfirmDel}
            onDelete={onDelete}
          />
        ))}

        {/* 大項目を追加 */}
        {addingParent === "root" ? (
          <AddRow
            depth={0}
            placeholder="大項目を追加"
            value={addingText}
            onChange={setAddingText}
            onSubmit={() => onAdd(null, 1)}
            onCancel={() => {
              setAddingParent(null)
              setAddingText("")
            }}
          />
        ) : (
          <button
            onClick={() => {
              setAddingParent("root")
              setAddingText("")
            }}
            className="mt-2 flex items-center gap-1 text-sm text-[#1b4da0] hover:underline"
          >
            <Plus className="w-4 h-4" /> 大項目を追加
          </button>
        )}
      </div>
    </div>
  )
}

// ---- 1ノード（再帰） ----
function TodoNode({
  node,
  kids,
  expanded,
  setExpanded,
  memoOpen,
  setMemoOpen,
  editingId,
  setEditingId,
  onEditTitle,
  onEditAssignee,
  onEditMemo,
  toggleCheck,
  leafStats,
  addingParent,
  setAddingParent,
  addingText,
  setAddingText,
  onAdd,
  confirmDel,
  setConfirmDel,
  onDelete,
}: {
  node: ProjectTodo
  kids: Record<string, ProjectTodo[]>
  expanded: Record<string, boolean>
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  memoOpen: Record<string, boolean>
  setMemoOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  editingId: string | null
  setEditingId: (v: string | null) => void
  onEditTitle: (id: string, title: string) => void
  onEditAssignee: (id: string, a: string | null) => void
  onEditMemo: (id: string, memo: string) => void
  toggleCheck: (id: string, v: boolean) => void
  leafStats: (id: string) => { done: number; total: number }
  addingParent: string | null
  setAddingParent: (v: string | null) => void
  addingText: string
  setAddingText: (v: string) => void
  onAdd: (parentId: string | null, level: number) => void
  confirmDel: string | null
  setConfirmDel: (v: string | null) => void
  onDelete: (id: string) => void
}) {
  const children = kids[node.id] ?? []
  const hasChildren = children.length > 0
  const isOpen = expanded[node.id] ?? false
  const stats = leafStats(node.id)
  const state: "checked" | "partial" | "unchecked" =
    stats.total > 0 && stats.done === stats.total
      ? "checked"
      : stats.done > 0
        ? "partial"
        : "unchecked"

  const depth = node.level - 1
  const rowBg =
    node.level === 1 ? "bg-white shadow-sm" : node.level === 2 ? "bg-white" : "bg-transparent"
  const titleCls =
    node.level === 1
      ? "font-bold text-gray-900"
      : node.level === 2
        ? "font-semibold text-gray-800"
        : "text-gray-700"

  const [memoDraft, setMemoDraft] = useState(node.memo)
  useEffect(() => setMemoDraft(node.memo), [node.memo])

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 hover:border-[#1b4da0]/30 hover:bg-blue-50/40 ${rowBg}`}
        style={{ marginLeft: depth * 22 }}
      >
        {/* 開閉 */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded((e) => ({ ...e, [node.id]: !isOpen }))}
            className="text-gray-400 hover:text-gray-700 flex-shrink-0"
            title={isOpen ? "閉じる" : "開く"}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* チェックボックス（親は子の状態を集約） */}
        <TriCheck state={state} onClick={() => toggleCheck(node.id, state !== "checked")} />

        {/* タイトル（クリックで編集） */}
        {editingId === node.id ? (
          <InlineEdit
            initial={node.title}
            onSubmit={(v) => onEditTitle(node.id, v)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <button
            className={`flex-1 text-left text-sm truncate ${titleCls} ${
              state === "checked" ? "line-through text-gray-400" : ""
            }`}
            title={node.title}
            onClick={() => setEditingId(node.id)}
          >
            {node.title}
          </button>
        )}

        {/* 親は進捗数 */}
        {hasChildren && (
          <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">
            {stats.done}/{stats.total}
          </span>
        )}

        {/* 担当プルダウン */}
        <AssigneeSelect value={node.assignee} onChange={(a) => onEditAssignee(node.id, a)} />

        {/* 行アクション（ホバーで表示） */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => setMemoOpen((m) => ({ ...m, [node.id]: !m[node.id] }))}
            className={`p-1 rounded hover:bg-gray-100 ${
              node.memo ? "text-amber-500" : "text-gray-400"
            }`}
            title="メモ"
          >
            <StickyNote className="w-4 h-4" />
          </button>
          {node.level < 3 && (
            <button
              onClick={() => {
                setExpanded((e) => ({ ...e, [node.id]: true }))
                setAddingParent(node.id)
                setAddingText("")
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#1b4da0]"
              title={`${LEVEL_LABEL[node.level + 1]}を追加`}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setConfirmDel(node.id)}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 削除確認 */}
      {confirmDel === node.id && (
        <div
          className="flex items-center gap-2 text-xs text-gray-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 my-1"
          style={{ marginLeft: depth * 22 + 24 }}
        >
          <span>「{node.title}」{hasChildren ? "と配下の項目" : ""}を削除しますか？</span>
          <Button size="sm" variant="destructive" className="h-6 px-2" onClick={() => onDelete(node.id)}>
            削除
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => setConfirmDel(null)}>
            キャンセル
          </Button>
        </div>
      )}

      {/* メモ欄 */}
      {memoOpen[node.id] && (
        <div className="my-1" style={{ marginLeft: depth * 22 + 24 }}>
          <Textarea
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            onBlur={() => onEditMemo(node.id, memoDraft)}
            placeholder="メモを入力（自動保存）"
            rows={2}
            className="text-sm"
          />
        </div>
      )}

      {/* 子 */}
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {children.map((c) => (
            <TodoNode
              key={c.id}
              node={c}
              kids={kids}
              expanded={expanded}
              setExpanded={setExpanded}
              memoOpen={memoOpen}
              setMemoOpen={setMemoOpen}
              editingId={editingId}
              setEditingId={setEditingId}
              onEditTitle={onEditTitle}
              onEditAssignee={onEditAssignee}
              onEditMemo={onEditMemo}
              toggleCheck={toggleCheck}
              leafStats={leafStats}
              addingParent={addingParent}
              setAddingParent={setAddingParent}
              addingText={addingText}
              setAddingText={setAddingText}
              onAdd={onAdd}
              confirmDel={confirmDel}
              setConfirmDel={setConfirmDel}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* 子の追加入力 */}
      {addingParent === node.id && (
        <AddRow
          depth={depth + 1}
          placeholder={`${LEVEL_LABEL[node.level + 1]}を追加`}
          value={addingText}
          onChange={setAddingText}
          onSubmit={() => onAdd(node.id, node.level + 1)}
          onCancel={() => {
            setAddingParent(null)
            setAddingText("")
          }}
        />
      )}
    </div>
  )
}

// 3状態チェックボックス
function TriCheck({
  state,
  onClick,
}: {
  state: "checked" | "partial" | "unchecked"
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
        state === "checked"
          ? "bg-[#1b4da0] border-[#1b4da0] text-white"
          : state === "partial"
            ? "bg-[#1b4da0]/15 border-[#1b4da0] text-[#1b4da0]"
            : "bg-white border-gray-300 hover:border-[#1b4da0]"
      }`}
      title={state === "checked" ? "完了" : state === "partial" ? "一部完了" : "未完了"}
    >
      {state === "checked" && <Check className="w-3.5 h-3.5" />}
      {state === "partial" && <Minus className="w-3.5 h-3.5" />}
    </button>
  )
}

// 担当プルダウン
function AssigneeSelect({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`h-7 rounded border text-xs px-1.5 flex-shrink-0 w-[88px] bg-white ${
        value ? "border-[#1b4da0]/40 text-gray-800" : "border-gray-200 text-gray-400"
      }`}
      title="担当"
    >
      <option value="">担当</option>
      {PJT_ASSIGNEES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  )
}

// インラインタイトル編集
function InlineEdit({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string
  onSubmit: (v: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <Input
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSubmit(v.trim() || initial)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(v.trim() || initial)
        if (e.key === "Escape") onCancel()
      }}
      className="flex-1 h-7 text-sm"
    />
  )
}

// 追加入力行
function AddRow({
  depth,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  depth: number
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className="flex items-center gap-2 my-1" style={{ marginLeft: depth * 22 + 24 }}>
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
          if (e.key === "Escape") onCancel()
        }}
        placeholder={placeholder}
        className="h-8 text-sm max-w-md"
      />
      <Button size="sm" className="h-8 bg-[#1b4da0] hover:bg-[#163f85]" onClick={onSubmit}>
        追加
      </Button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-700" title="キャンセル">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
