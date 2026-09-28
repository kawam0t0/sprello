import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { assigneeEmail } from "@/lib/pjt-assignee-emails"
import {
  calendarConfigured,
  createAllDayEvent,
  updateAllDayEvent,
  deleteEvent,
} from "@/lib/google-calendar"

export const runtime = "nodejs"

// PJT進捗の1項目（todo）を、担当者本人のGoogleカレンダーへ終日予定として同期する。
//  - 日付あり＋担当あり … 予定を作成 or 更新（担当が変わっていれば旧カレンダーから移動）
//  - 日付なし / 担当なし … 既存の予定があれば削除
// 連携が未設定(env未設定)ならスキップ（アプリの通常動作は妨げない）。
export async function POST(request: Request) {
  try {
    const { todoId } = await request.json()
    if (!todoId || typeof todoId !== "string") {
      return NextResponse.json({ error: "todoId is required" }, { status: 400 })
    }

    // 連携未設定ならここで終了（成功扱い・スキップ）
    if (!calendarConfigured()) {
      return NextResponse.json({ ok: true, skipped: "calendar_not_configured" })
    }

    // 対象todoを取得
    const { data: todo, error } = await supabase
      .from("project_todos")
      .select("id, card_id, title, assignee, due_date, gcal_event_id, gcal_calendar_id")
      .eq("id", todoId)
      .single()
    if (error || !todo) {
      return NextResponse.json({ error: "todo not found" }, { status: 404 })
    }

    const due: string | null = todo.due_date ?? null
    const email = assigneeEmail(todo.assignee)
    const prevEventId: string | null = todo.gcal_event_id ?? null
    const prevCal: string | null = todo.gcal_calendar_id ?? null

    // 予定タイトル：【店舗名】項目名
    let storeName = ""
    const { data: card } = await supabase.from("cards").select("title").eq("id", todo.card_id).single()
    if (card?.title) storeName = card.title
    const summary = storeName ? `【${storeName}】${todo.title}` : todo.title

    const clearCols = async () => {
      await supabase
        .from("project_todos")
        .update({ gcal_event_id: null, gcal_calendar_id: null, updated_at: new Date().toISOString() })
        .eq("id", todo.id)
    }
    const saveCols = async (eventId: string, cal: string) => {
      await supabase
        .from("project_todos")
        .update({ gcal_event_id: eventId, gcal_calendar_id: cal, updated_at: new Date().toISOString() })
        .eq("id", todo.id)
    }

    // 日付なし or 担当なし → 予定を消す
    if (!due || !email) {
      if (prevEventId && prevCal) {
        await deleteEvent({ calendarEmail: prevCal, eventId: prevEventId }).catch(() => {})
        await clearCols()
        return NextResponse.json({ ok: true, action: "deleted" })
      }
      return NextResponse.json({ ok: true, action: "noop" })
    }

    // 既存予定あり
    if (prevEventId && prevCal) {
      if (prevCal === email) {
        // 同じ担当 → 日付/タイトルを更新
        await updateAllDayEvent({ calendarEmail: email, eventId: prevEventId, summary, ymd: due, todoId: todo.id })
        return NextResponse.json({ ok: true, action: "updated" })
      }
      // 担当が変わった → 旧カレンダーから削除して新カレンダーへ作成
      await deleteEvent({ calendarEmail: prevCal, eventId: prevEventId }).catch(() => {})
      const newId = await createAllDayEvent({ calendarEmail: email, summary, ymd: due, todoId: todo.id })
      await saveCols(newId, email)
      return NextResponse.json({ ok: true, action: "moved" })
    }

    // 新規作成
    const newId = await createAllDayEvent({ calendarEmail: email, summary, ymd: due, todoId: todo.id })
    await saveCols(newId, email)
    return NextResponse.json({ ok: true, action: "created" })
  } catch (e) {
    console.error("[api/pjt-calendar/sync] error:", e)
    return NextResponse.json({ error: "sync failed" }, { status: 500 })
  }
}
