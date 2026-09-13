import { supabase } from "./supabase"
import { PJT_TODO_TEMPLATE, type TodoSeed } from "./pjt-todo-template"

// プロジェクトTODO（大中小の1行）
export interface ProjectTodo {
  id: string
  card_id: string
  parent_id: string | null
  level: number // 1=大, 2=中, 3=小
  title: string
  checked: boolean
  assignee: string | null
  memo: string
  position: number
  created_at?: string
  updated_at?: string
}

// 指定プロジェクトのTODOを全件取得（フラット）
export async function getProjectTodos(cardId: string): Promise<ProjectTodo[]> {
  const { data, error } = await supabase
    .from("project_todos")
    .select("*")
    .eq("card_id", cardId)
    .order("position")
  if (error) {
    console.error("[getProjectTodos] error:", error)
    throw error
  }
  return (data as ProjectTodo[]) ?? []
}

// テンプレートを指定プロジェクトへ複製（親→子の順にINSERTして parent_id を解決）
// 担当は大項目に設定された既定値を、中項目・小項目へそのまま継承する。
export async function seedProjectTodos(cardId: string): Promise<ProjectTodo[]> {
  const insertNode = async (
    node: TodoSeed,
    level: number,
    parentId: string | null,
    position: number,
    inheritedAssignee: string | null,
  ): Promise<void> => {
    const assignee = node.assignee ?? inheritedAssignee ?? null
    const { data, error } = await supabase
      .from("project_todos")
      .insert({
        card_id: cardId,
        parent_id: parentId,
        level,
        title: node.title,
        assignee,
        memo: node.memo ?? "",
        position,
        checked: false,
      })
      .select()
      .single()
    if (error) throw error
    const id = (data as ProjectTodo).id
    if (node.children?.length) {
      // 子はまとめて順番に（親IDが必要なので直列）
      let i = 0
      for (const child of node.children) {
        await insertNode(child, level + 1, id, i++, assignee)
      }
    }
  }

  let i = 0
  for (const top of PJT_TODO_TEMPLATE) {
    await insertNode(top, 1, null, i++, null)
  }
  return getProjectTodos(cardId)
}

// 二重シード防止：同じプロジェクトへの同時シードを直列化する（開発時の StrictMode で
// useEffect が2回走っても、TODOが二重に作られないようにする）。
const seedInFlight = new Map<string, Promise<ProjectTodo[]>>()
export async function ensureProjectTodos(cardId: string): Promise<ProjectTodo[]> {
  const rows = await getProjectTodos(cardId)
  if (rows.length > 0) return rows
  const running = seedInFlight.get(cardId)
  if (running) return running
  const p = seedProjectTodos(cardId).finally(() => seedInFlight.delete(cardId))
  seedInFlight.set(cardId, p)
  return p
}

// 1件追加
export async function addTodo(input: {
  card_id: string
  parent_id: string | null
  level: number
  title: string
  position: number
  assignee?: string | null
}): Promise<ProjectTodo> {
  const { data, error } = await supabase
    .from("project_todos")
    .insert({
      card_id: input.card_id,
      parent_id: input.parent_id,
      level: input.level,
      title: input.title,
      position: input.position,
      assignee: input.assignee ?? null,
      memo: "",
      checked: false,
    })
    .select()
    .single()
  if (error) throw error
  return data as ProjectTodo
}

// 1件更新（title/checked/assignee/memo など）
export async function updateTodo(
  id: string,
  patch: Partial<Pick<ProjectTodo, "title" | "checked" | "assignee" | "memo" | "position">>,
): Promise<void> {
  const { error } = await supabase
    .from("project_todos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

// 複数件のチェック状態を一括更新
export async function setCheckedMany(ids: string[], checked: boolean): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from("project_todos")
    .update({ checked, updated_at: new Date().toISOString() })
    .in("id", ids)
  if (error) throw error
}

// 複数件の担当を一括更新（親の担当を子孫へ揃える用）
export async function setAssigneeMany(ids: string[], assignee: string | null): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from("project_todos")
    .update({ assignee, updated_at: new Date().toISOString() })
    .in("id", ids)
  if (error) throw error
}

// 1件削除（子はDBのCASCADEで一緒に消える）
export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from("project_todos").delete().eq("id", id)
  if (error) throw error
}
