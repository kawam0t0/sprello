"use client"

import { useMemo, useState } from "react"
import type { BoardData, Card } from "@/types/database"
import { ExternalLink } from 'lucide-react'
import { updateCard } from "@/lib/database-operations"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TimelineViewProps {
  board: BoardData
}

interface TimelineItem {
  card: Card
  listTitle: string
  startDate: Date | null
  startEndDate: Date | null
  setupStartDate: Date | null
  setupEndDate: Date | null
  openDate: Date | null
  openEndDate: Date | null
  openFollowStartDate: Date | null
  openFollowEndDate: Date | null
  paymentDates: { start: Date; end: Date }[]
}

export function TimelineView({ board }: TimelineViewProps) {
  const [editingDate, setEditingDate] = useState<{
    cardId: string
    cardTitle: string
    type: 'start' | 'open'
    currentDate: string
  } | null>(null)
  const [newDate, setNewDate] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []

    board.lists.forEach((list) => {
      list.cards.forEach((card) => {
        if (card.open_date || card.start_date) {
          const openDate = card.open_date ? new Date(card.open_date) : null
          const startDate = card.start_date ? new Date(card.start_date) : null

          let startEndDate: Date | null = null
          let openEndDate: Date | null = null
          let openFollowStartDate: Date | null = null
          let openFollowEndDate: Date | null = null

          if (openDate) {
            openEndDate = new Date(openDate)
            openEndDate.setDate(openEndDate.getDate() + 1) // OPEN日 + 1日 = 2日間
            console.log('[v0] OPEN期間:', openDate.toISOString(), '〜', openEndDate.toISOString())
          }

          let setupStartDate: Date | null = null
          let setupEndDate: Date | null = null

          if (openDate) {
            setupStartDate = new Date(openDate)
            setupStartDate.setMonth(setupStartDate.getMonth() - 1)
            
            setupEndDate = new Date(openDate)
            setupEndDate.setDate(setupEndDate.getDate() - 1)
          }

          if (startDate && setupStartDate) {
            startEndDate = new Date(setupStartDate)
            startEndDate.setDate(startEndDate.getDate() - 1)
          }

          if (openDate && openEndDate) {
            openFollowStartDate = new Date(openEndDate)
            openFollowStartDate.setDate(openFollowStartDate.getDate() + 3) // OPEN終了日から3日後
            
            openFollowEndDate = new Date(openFollowStartDate)
            openFollowEndDate.setMonth(openFollowEndDate.getMonth() + 1) // 1ヶ月間
          }

          const paymentDates: { start: Date; end: Date }[] = []
          
          if (startDate) {
            const payment1Start = new Date(startDate)
            payment1Start.setDate(payment1Start.getDate() - 10)
            const payment1End = new Date(payment1Start)
            payment1End.setDate(payment1End.getDate() + 6)
            paymentDates.push({ start: payment1Start, end: payment1End })
          }
          
          if (setupStartDate) {
            const payment2Start = new Date(setupStartDate)
            payment2Start.setMonth(payment2Start.getMonth() - 1)
            const payment2End = new Date(payment2Start)
            payment2End.setDate(payment2End.getDate() + 6)
            paymentDates.push({ start: payment2Start, end: payment2End })
          }
          
          if (openDate) {
            const payment3Start = new Date(openDate)
            payment3Start.setMonth(payment3Start.getMonth() + 1)
            const payment3End = new Date(payment3Start)
            payment3End.setDate(payment3End.getDate() + 6)
            paymentDates.push({ start: payment3Start, end: payment3End })
          }

          items.push({
            card,
            listTitle: list.title,
            startDate,
            startEndDate,
            setupStartDate,
            setupEndDate,
            openDate,
            openEndDate,
            openFollowStartDate,
            openFollowEndDate,
            paymentDates,
          })
        }
      })
    })

    return items.sort((a, b) => {
      const aDate = a.startDate || a.setupStartDate || a.openDate
      const bDate = b.startDate || b.setupStartDate || b.openDate
      if (!aDate || !bDate) return 0
      return aDate.getTime() - bDate.getTime()
    })
  }, [board])

  const dateRange = useMemo(() => {
    if (timelineItems.length === 0) return { start: new Date(), end: new Date(), months: [] }

    let minDate: Date | null = null
    let maxDate: Date | null = null

    timelineItems.forEach((item) => {
      const dates = [
        item.startDate,
        item.startEndDate,
        item.setupStartDate,
        item.openDate,
        item.openEndDate,
        item.openFollowStartDate,
        item.openFollowEndDate,
        ...item.paymentDates.map(p => p.start),
        ...item.paymentDates.map(p => p.end),
      ].filter((d): d is Date => d !== null)

      dates.forEach((date) => {
        if (!minDate || date < minDate) minDate = date
        if (!maxDate || date > maxDate) maxDate = date
      })
    })

    if (!minDate || !maxDate) return { start: new Date(), end: new Date(), months: [] }

    const start = new Date(minDate)
    start.setMonth(start.getMonth() - 1)
    start.setDate(1)

    const end = new Date(maxDate)
    end.setMonth(end.getMonth() + 2)
    end.setDate(0)

    const months: { year: number; month: number; label: string }[] = []
    const current = new Date(start)

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        label: `${current.getFullYear()}年${current.getMonth() + 1}月`,
      })
      current.setMonth(current.getMonth() + 1)
    }

    return { start, end, months }
  }, [timelineItems])

  const dateToPosition = (date: Date): number => {
    const totalDays =
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    const daysSinceStart =
      (date.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    return (daysSinceStart / totalDays) * 100
  }

  const getPeriodWidth = (start: Date, end: Date): number => {
    const endPos = dateToPosition(end)
    const startPos = dateToPosition(start)
    return endPos - startPos
  }

  const handleBarClick = (cardId: string, cardTitle: string, type: 'start' | 'open', currentDate: string) => {
    setEditingDate({ cardId, cardTitle, type, currentDate })
    setNewDate(currentDate)
  }

  const handleDateUpdate = async () => {
    if (!editingDate || !newDate) return

    setIsUpdating(true)
    try {
      const updateData = editingDate.type === 'start' 
        ? { start_date: newDate }
        : { open_date: newDate }
      
      await updateCard(editingDate.cardId, updateData)
      setEditingDate(null)
      setNewDate("")
    } catch (error) {
      console.error("日付の更新に失敗しました:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (timelineItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">表示するプロジェクトがありません</p>
          <p className="text-sm mt-2">OPEN日または着工日が設定されているカードがタイムラインに表示されます</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto bg-white">
        <div className="min-w-[1200px] p-6">
          <div className="flex mb-6">
            <div className="w-72 flex-shrink-0 pr-4">
              <h3 className="font-bold text-lg text-gray-800 py-3">プロジェクト名</h3>
            </div>
            <div className="flex-1">
              <div className="flex bg-gradient-to-r from-teal-50 to-cyan-50 rounded-t-lg overflow-hidden border-b-2 border-teal-400">
                {dateRange.months.map((month, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center py-3 border-l border-teal-200 first:border-l-0"
                  >
                    <div className="text-sm font-bold text-gray-700">{month.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {timelineItems.map((item, idx) => {
              
              return (
                <div key={idx} className="flex items-stretch">
                  <div className="w-72 flex-shrink-0 pr-4">
                    <div className="p-3 rounded-lg shadow-sm border-l-4 border-gray-400 bg-white hover:shadow-md transition-shadow">
                      <p className="text-sm font-bold text-gray-800 mb-2" title={item.card.title}>
                        {item.card.title}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-medium">
                          {item.listTitle}
                        </span>
                      </div>
                      {(item.card.company_url || item.card.candidate_url) && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.card.company_url && (
                            <button
                              onClick={() => window.open(item.card.company_url, '_blank', 'noopener,noreferrer')}
                              className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full hover:bg-indigo-100 flex items-center gap-1 font-medium transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              企業
                            </button>
                          )}
                          {item.card.candidate_url && (
                            <button
                              onClick={() => window.open(item.card.candidate_url, '_blank', 'noopener,noreferrer')}
                              className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full hover:bg-teal-100 flex items-center gap-1 font-medium transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              候補地1
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative h-24 bg-gray-50 rounded-lg border border-gray-200">
                    {item.paymentDates.map((payment, payIdx) => (
                      <div
                        key={payIdx}
                        className="absolute top-3 h-6 bg-yellow-500 bg-opacity-70 rounded-full flex items-center justify-center text-xs text-white font-bold group shadow-md hover:bg-opacity-80 transition-all cursor-default"
                        style={{
                          left: `${dateToPosition(payment.start)}%`,
                          width: `${getPeriodWidth(payment.start, payment.end)}%`,
                          minWidth: "50px",
                        }}
                      >
                        <span className="text-[10px]">着金{payIdx + 1}</span>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          着金{payIdx + 1}: {payment.start.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 〜 {payment.end.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </div>
                      </div>
                    ))}

                    {item.startDate && item.startEndDate && (
                      <div
                        className="absolute top-12 h-6 bg-green-500 bg-opacity-70 rounded-full flex items-center justify-center text-xs text-white font-bold group shadow-md hover:bg-opacity-80 transition-all cursor-pointer"
                        style={{
                          left: `${dateToPosition(item.startDate)}%`,
                          width: `${getPeriodWidth(item.startDate, item.startEndDate)}%`,
                          minWidth: "50px",
                        }}
                        onClick={() => handleBarClick(item.card.id, item.card.title, 'start', item.card.start_date!)}
                      >
                        <span className="text-[10px]">工事期間</span>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          工事期間: {item.startDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 〜 {item.startEndDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                          <div className="text-[10px] text-gray-300 mt-0.5">クリックで着工日を変更</div>
                        </div>
                      </div>
                    )}

                    {item.setupStartDate && item.setupEndDate && (
                      <div
                        className="absolute top-12 h-6 bg-blue-500 bg-opacity-60 rounded-full flex items-center justify-center text-xs text-white font-bold group shadow-md hover:bg-opacity-70 transition-all cursor-default"
                        style={{
                          left: `${dateToPosition(item.setupStartDate)}%`,
                          width: `${getPeriodWidth(item.setupStartDate, item.setupEndDate)}%`,
                          minWidth: "60px",
                        }}
                      >
                        <span className="text-[10px]">設営</span>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          設営: {item.setupStartDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 〜 {item.setupEndDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </div>
                      </div>
                    )}

                    {item.openDate && item.openEndDate && (
                      <div
                        className="absolute top-12 h-6 bg-pink-400 bg-opacity-70 rounded-full flex items-center justify-center text-xs text-white font-bold group shadow-md hover:bg-opacity-80 transition-all cursor-pointer"
                        style={{
                          left: `${dateToPosition(item.openDate)}%`,
                          width: `${getPeriodWidth(item.openDate, item.openEndDate)}%`,
                          minWidth: "20px", // 最小幅を小さくして2日間を正しく表示
                        }}
                        onClick={() => handleBarClick(item.card.id, item.card.title, 'open', item.card.open_date!)}
                      >
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          OPEN期間: {item.openDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 〜 {item.openEndDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                          <div className="text-[10px] text-gray-300 mt-0.5">クリックでOPEN日を変更</div>
                        </div>
                      </div>
                    )}

                    {item.openFollowStartDate && item.openFollowEndDate && (
                      <div
                        className="absolute top-12 h-6 bg-purple-500 bg-opacity-60 rounded-full flex items-center justify-center text-xs text-white font-bold group shadow-md hover:bg-opacity-70 transition-all cursor-default"
                        style={{
                          left: `${dateToPosition(item.openFollowStartDate)}%`,
                          width: `${getPeriodWidth(item.openFollowStartDate, item.openFollowEndDate)}%`,
                          minWidth: "80px",
                        }}
                      >
                        <span className="text-[10px]">OPENフォロー</span>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          OPENフォロー: {item.openFollowStartDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 〜 {item.openFollowEndDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-8 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div className="flex gap-8 justify-center items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-12 h-5 bg-yellow-500 bg-opacity-70 rounded-full shadow-sm"></div>
                <span className="text-gray-700 font-medium">着金期間</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-5 bg-green-500 bg-opacity-70 rounded-full shadow-sm"></div>
                <span className="text-gray-700 font-medium">工事期間</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-5 bg-blue-500 bg-opacity-60 rounded-full shadow-sm"></div>
                <span className="text-gray-700 font-medium">設営期間</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-5 bg-pink-400 bg-opacity-70 rounded-full shadow-sm"></div>
                <span className="text-gray-700 font-medium">OPEN期間</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-5 bg-purple-500 bg-opacity-60 rounded-full shadow-sm"></div>
                <span className="text-gray-700 font-medium">OPENフォロー</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!editingDate} onOpenChange={(open) => !open && setEditingDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日付の変更</DialogTitle>
            <DialogDescription>
              {editingDate?.cardTitle} の{editingDate?.type === 'start' ? '着工日' : 'OPEN日'}を変更します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">{editingDate?.type === 'start' ? '着工日' : 'OPEN日'}</Label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDate(null)} disabled={isUpdating}>
              キャンセル
            </Button>
            <Button onClick={handleDateUpdate} disabled={isUpdating || !newDate}>
              {isUpdating ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
