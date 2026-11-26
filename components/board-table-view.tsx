"use client"

import { Eye, Trash2 } from "lucide-react"
import type { Card } from "@/types/database"

type Row = { card: Card; listTitle: string }

// YYYY-MM-DD → YYYY/MM/DD（確定した正確な日付を表示）。未設定は —
function fmtDate(s?: string | null): string {
  if (!s) return "—"
  const d = new Date(s)
  if (isNaN(d.getTime())) return "—"
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

// ボードを「行（テーブル）」で表示。OPEN日/着工日/設営日/初回入金日/二回目入金日を常時表示。
// 「詳細」ボタンでタスク詳細（その他の項目）を開く。
export function BoardTableView({
  rows,
  onOpen,
  onDelete,
}: {
  rows: Row[]
  onOpen: (card: Card) => void
  onDelete: (card: Card) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[#1b2b4b] text-xs text-white">
            <th className="px-3 py-3 font-semibold">ヨミ</th>
            <th className="px-3 py-3 font-semibold">プロジェクト名</th>
            <th className="px-3 py-3 text-center font-semibold">OPEN日</th>
            <th className="px-3 py-3 text-center font-semibold">着工日</th>
            <th className="px-3 py-3 text-center font-semibold">設営日</th>
            <th className="px-3 py-3 text-center font-semibold">初回入金日</th>
            <th className="px-3 py-3 text-center font-semibold">二回目入金日</th>
            <th className="px-3 py-3 text-center font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, listTitle }, i) => (
            <tr key={card.id} className={i % 2 ? "bg-gray-50" : "bg-white"}>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5">
                <span className="inline-block rounded-full bg-[#1b4da0]/10 px-2 py-0.5 text-[11px] font-bold text-[#1b4da0]">
                  {listTitle}
                </span>
              </td>
              <td className="border-t border-gray-100 px-3 py-2.5">
                <button
                  onClick={() => onOpen(card)}
                  className="text-left font-semibold text-gray-900 hover:text-[#1b4da0] hover:underline"
                >
                  {card.store_name || card.title}
                </button>
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center tabular-nums">
                {fmtDate(card.open_date)}
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center tabular-nums">
                {fmtDate(card.start_date)}
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center tabular-nums">
                {fmtDate(card.setup_date)}
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center tabular-nums">
                {fmtDate(card.payment1_date)}
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center tabular-nums">
                {fmtDate(card.payment2_date)}
              </td>
              <td className="whitespace-nowrap border-t border-gray-100 px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => onOpen(card)}
                    className="inline-flex items-center gap-1 rounded border border-[#1b4da0]/40 bg-blue-50 px-2 py-1 text-xs font-medium text-[#1b4da0] hover:bg-blue-100"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    詳細
                  </button>
                  <button
                    onClick={() => onDelete(card)}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                プロジェクトがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
