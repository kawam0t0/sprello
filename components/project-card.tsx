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

// 出店データ（地図・商圏）の入力チェック項目
function missingFields(card: CardType): string[] {
  const checks: [string, boolean][] = [
    ["ランク", !card.rank],
    ["立地", !card.location_type],
    ["交通量", card.traffic_12h == null],
    ["周辺充実度", card.surrounding_score == null],
    ["通過速度", card.passing_speed == null],
    ["認知度", card.awareness == null],
    ["世帯年収", card.household_income == null],
    ["広さ", card.size_tsubo == null],
    ["台数", card.car_capacity == null],
    ["拭上げ", card.wipe_spaces == null],
    ["商圏人口", card.pop_1km == null],
  ]
  return checks.filter(([, empty]) => empty).map(([label]) => label)
}

export function ProjectCard({ card, onOpen, onDelete }: Props) {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })
  const brand = normalizeCategory(card.category)
  const brandColor = CATEGORY_COLORS[brand]
  const missing = missingFields(card)

  return (
    <Card
      className="h-[240px] bg-white shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col overflow-hidden"
      onClick={() => onOpen(card)}
    >
      {/* ブランド帯（はっきり表示） */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-white"
        style={{ backgroundColor: brandColor }}
      >
        <span className="text-sm font-bold tracking-wide truncate">{brand}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Edit
            className="w-3.5 h-3.5 opacity-80 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(card)
            }}
          />
          <Trash2
            className="w-3.5 h-3.5 opacity-80 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(card.id)
            }}
          />
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-1.5">
        {/* タイトル */}
        <p className="text-sm font-semibold text-gray-800 line-clamp-2">{card.title}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          {card.rank && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              ランク{card.rank}
            </span>
          )}
          {card.open_date && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
              OPEN {fmtDate(card.open_date)}
            </span>
          )}
          {card.start_date && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
              着工 {fmtDate(card.start_date)}
            </span>
          )}
        </div>

        {card.address && (
          <div className="flex items-start gap-1 text-[11px] text-gray-500">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">{card.address}</span>
          </div>
        )}

        {card.pop_1km != null && (
          <div className="text-[10px] text-gray-400">
            商圏 1/2/5km:{" "}
            {[card.pop_1km, card.pop_2km, card.pop_5km]
              .map((p) => (p != null ? Number(p).toLocaleString() : "-"))
              .join(" / ")}
          </div>
        )}

        {/* 出店データの未入力表示 */}
        {missing.length > 0 ? (
          <div className="pt-1 border-t border-gray-100">
            <div className="text-[10px] text-rose-500 font-medium mb-0.5">
              出店データ未入力（{missing.length}）
            </div>
            <div className="flex flex-wrap gap-1">
              {missing.map((m) => (
                <span
                  key={m}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-1 border-t border-gray-100 text-[10px] text-emerald-600 font-medium">
            ✓ 出店データ入力済み
          </div>
        )}
      </div>

      {/* リンク（下部固定） */}
      {(card.candidate_url || card.company_url) && (
        <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-gray-100">
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
