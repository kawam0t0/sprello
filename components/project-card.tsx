"use client"

import { Edit, Trash2, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { CATEGORY_COLORS, normalizeCategory } from "@/types/database"
import type { Card as CardType } from "@/types/database"

interface Props {
  card: CardType
  onOpen: (card: CardType) => void
  onDelete: (cardId: string) => void
}

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
      className="h-[290px] bg-white shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 rounded-lg border-t-4 flex flex-col overflow-hidden"
      style={{ borderTopColor: brandColor }}
      onClick={() => onOpen(card)}
    >
      <div className="p-3 flex flex-col h-full">
        {/* Trello風ラベル（ブランド色）＋操作 */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[11px] font-bold text-white px-2 py-0.5 rounded"
            style={{ backgroundColor: brandColor }}
          >
            {brand}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Edit
              className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation()
                onOpen(card)
              }}
            />
            <Trash2
              className="w-3.5 h-3.5 text-red-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(card.id)
              }}
            />
          </div>
        </div>

        {/* タイトル */}
        <p className="mt-1.5 text-sm font-semibold text-gray-800 line-clamp-2">{card.title}</p>

        {/* 出店データ未入力（パッと見える位置） */}
        <div className="mt-2">
          {missing.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="text-[11px] text-emerald-600 font-medium">✓ 出店データ入力済み</div>
          )}
        </div>

        {/* 補足情報（下側） */}
        <div className="mt-auto space-y-1 pt-2">
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
        </div>
      </div>
    </Card>
  )
}
