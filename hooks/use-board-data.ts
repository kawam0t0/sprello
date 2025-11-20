"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { BoardData } from "@/types/database"

export function useBoardData(boardId = "550e8400-e29b-41d4-a716-446655440000") {
  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // データを取得する関数
  const fetchBoardData = async () => {
    try {
      setLoading(true)

      // ボード情報を取得
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select("*")
        .eq("id", boardId)
        .single()

      if (boardError) throw boardError

      // リスト情報を取得
      const { data: listsData, error: listsError } = await supabase
        .from("lists")
        .select("*")
        .eq("board_id", boardId)
        .order("position")

      if (listsError) throw listsError

      // カード情報を取得
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .in(
          "list_id",
          listsData.map((list) => list.id),
        )
        .order("position")

      if (cardsError) throw cardsError

      // データを結合
      const listsWithCards = listsData.map((list) => ({
        ...list,
        cards: cardsData.filter((card) => card.list_id === list.id),
      }))

      setBoard({
        ...boardData,
        lists: listsWithCards,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // リアルタイム購読を設定
  useEffect(() => {
    fetchBoardData()

    // リアルタイム購読
    const channel = supabase
      .channel("board-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, () =>
        fetchBoardData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, () => fetchBoardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => fetchBoardData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [boardId])

  return { board, loading, error, refetch: fetchBoardData }
}
