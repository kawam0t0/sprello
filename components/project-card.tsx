"use client"

import { Edit, Trash2, ExternalLink, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { CATEGORY_COLORS, normalizeCategory } from "@/types/database"
import type { Card as CardType } from "@/types/database"

interface Props {
  card: CardType
  onOpen: (card: CardType) => void
  onDelete: (cardId: string) => void
}

// 高さ統一のプロジェクトカード
export function ProjectCard({ card, onOpen, onDelete }: Props) {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })

  return (
    <Card
      className="h-[240px] p-3 bg-white shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col"
      onClick={() => onOpen(card)}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-800 flex-1 line-clamp-2">{card.title}</p>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <Edit
            className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(card)
            }}
          />
          <Trash2
            className="w-3.5 h-3.5 text-red-400 cursor-pointer hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(card.id)
            }}
          />
        </div>
      </div>

      {/* バッジ類・詳細（あふれたらスクロール） */}
      <div className="mt-1.5 flex-1 overflow-y-auto space-y-1 pr-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: CATEGORY_COLORS[normalizeCategory(card.category)] }}
          >
            {normalizeCategory(card.category)}
          </span>
          {card.rank && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              ランク{card.rank}
            </span>
          )}
          {card.brand && <span className="text-[10px] text-gray-500">{card.brand}</span>}
        </div>

        {card.address && (
          <div className="flex items-start gap-1 text-[11px] text-gray-500">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">{card.address}</span>
          </div>
        )}

        {(card.pop_1km != null || card.pop_2km != null || card.pop_5km != null) && (
          <div className="text-[10px] text-gray-400">
            商圏 1/2/5km:{" "}
            {[card.pop_1km, card.pop_2km, card.pop_5km]
              .map((p) => (p != null ? Number(p).toLocaleString() : "-"))
              .join(" / ")}
          </div>
        )}

        {card.status && (
          <div>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{card.status}</span>
          </div>
        )}
        {card.open_date && (
          <div>
            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
              OPEN: {fmtDate(card.open_date)}予定
            </span>
          </div>
        )}
        {card.start_date && (
          <div>
            <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
              着工: {fmtDate(card.start_date)}予定
            </span>
          </div>
        )}
        {card.company_name && (
          <div>
            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
              {card.company_name}
            </span>
          </div>
        )}
      </div>

      {/* リンク（下部固定） */}
      {(card.candidate_url || card.company_url) && (
        <div className="mt-2 flex flex-wrap gap-1 pt-1 border-t border-gray-100">
          {card.company_url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(card.company_url, "_blank", "noopener,noreferrer")
              }}
              className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full hover:bg-indigo-200 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              企業
            </button>
          )}
          {card.candidate_url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(card.candidate_url, "_blank", "noopener,noreferrer")
              }}
              className="bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full hover:bg-teal-200 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              候補地
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
