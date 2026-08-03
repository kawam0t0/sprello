"use client"

import type React from "react"
import { useState } from "react"
import { Plus, MoreHorizontal, X, Edit, Calendar, Trash2, ExternalLink, LayoutList, CalendarDays, MapIcon, MapPin } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TimelineView } from "@/components/timeline-view"
import { MapView } from "@/components/map-view"
import { ProjectForm, type ProjectFormValues } from "@/components/project-form"

// Supabase関連のimport
import { useBoardData } from "@/hooks/use-board-data"
import { createCard, updateCard, deleteCard, moveCard, swapCards, getCardCount, createProject, geocodeAddress } from "@/lib/database-operations"
import { CATEGORY_COLORS, PROJECT_CATEGORIES } from "@/types/database"
import type { Card as CardType, ProjectCategory } from "@/types/database"

export default function Home() {
  // Supabaseからデータを取得
  const { board, loading, error, refetch } = useBoardData()

  const [viewMode, setViewMode] = useState<"board" | "timeline" | "map">("board")

  // 新規プロジェクト作成フォーム
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  const [statusOptions, setStatusOptions] = useState(["見積待ち", "融資待ち", "補助金待ち", "社内稟議待ち"])
  const [newStatusOption, setNewStatusOption] = useState("")
  const [showAddStatus, setShowAddStatus] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState("")
  const [showAddCard, setShowAddCard] = useState<string | null>(null)
  const [draggedCard, setDraggedCard] = useState<CardType | null>(null)
  const [draggedFromList, setDraggedFromList] = useState<string | null>(null)
  const [dragOverList, setDragOverList] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)

  // 削除確認ダイアログ用の状態
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [cardToDelete, setCardToDelete] = useState<{ cardId: string; listId: string } | null>(null)

  // ローディング中の表示
  if (loading) {
    return (
      <div className="h-screen bg-yellow-400 flex flex-col items-center justify-center">
        <div className="text-white text-xl mb-4">読み込み中...</div>
      </div>
    )
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="h-screen bg-yellow-400 flex flex-col items-center justify-center">
        <div className="text-red-600 text-xl mb-4">エラー: {error}</div>
        <Button onClick={refetch} className="bg-yellow-500 hover:bg-yellow-600">
          再試行
        </Button>
      </div>
    )
  }

  // ボードデータがない場合
  if (!board) {
    return (
      <div className="h-screen bg-yellow-400 flex flex-col items-center justify-center">
        <div className="text-white text-xl mb-4">ボードが見つかりません</div>
        <Button onClick={refetch} className="bg-yellow-500 hover:bg-yellow-600">
          再試行
        </Button>
      </div>
    )
  }

  const addCard = async (listId: string) => {
    if (!newCardTitle.trim()) return

    try {
      console.log("カード作成開始:", { listId, title: newCardTitle })
      const cardCount = await getCardCount(listId)
      console.log("現在のカード数:", cardCount)

      const newCard = await createCard(listId, newCardTitle, cardCount)
      console.log("カード作成成功:", newCard)

      setNewCardTitle("")
      setShowAddCard(null)
      refetch() // データを再取得
    } catch (error) {
      console.error("カード作成エラー:", error)
      alert("カードの作成に失敗しました: " + (error instanceof Error ? error.message : "不明なエラー"))
    }
  }

  // 新規プロジェクトを作成（先頭リストに追加）
  const handleCreateProject = async (values: ProjectFormValues) => {
    if (!board || board.lists.length === 0) {
      alert("リストがありません。先にリストを作成してください。")
      return
    }
    try {
      setCreatingProject(true)
      const targetList = board.lists[0] // 未確定など先頭のリスト
      const cardCount = await getCardCount(targetList.id)
      await createProject(targetList.id, values, cardCount)
      setProjectFormOpen(false)
      refetch()
    } catch (error) {
      console.error("プロジェクト作成エラー:", error)
      alert("プロジェクトの作成に失敗しました: " + (error instanceof Error ? error.message : "不明なエラー"))
    } finally {
      setCreatingProject(false)
    }
  }

  const addStatusOption = () => {
    if (!newStatusOption.trim() || statusOptions.includes(newStatusOption)) return

    setStatusOptions([...statusOptions, newStatusOption])
    setNewStatusOption("")
    setShowAddStatus(false)
  }

  const handleUpdateCard = async (updatedCard: CardType) => {
    try {
      // 住所があって緯度経度が無い場合はジオコーディングして補完
      let lat = updatedCard.lat ?? null
      let lng = updatedCard.lng ?? null
      if (updatedCard.address && (lat == null || lng == null)) {
        const geo = await geocodeAddress(updatedCard.address)
        lat = geo.lat
        lng = geo.lng
      }
      await updateCard(updatedCard.id, {
        title: updatedCard.title,
        status: updatedCard.status,
        memo: updatedCard.memo,
        open_date: updatedCard.open_date,
        start_date: updatedCard.start_date,
        candidate_url: updatedCard.candidate_url,
        candidate_url2: updatedCard.candidate_url2,
        company_name: updatedCard.company_name,
        company_url: updatedCard.company_url,
        // ArmBox項目
        category: updatedCard.category,
        district: updatedCard.district,
        property_no: updatedCard.property_no,
        brand: updatedCard.brand,
        store_name: updatedCard.store_name,
        location_type: updatedCard.location_type,
        prefecture: updatedCard.prefecture,
        address: updatedCard.address,
        rank: updatedCard.rank,
        traffic_12h: updatedCard.traffic_12h,
        surrounding_score: updatedCard.surrounding_score,
        passing_speed: updatedCard.passing_speed,
        corner_lot: updatedCard.corner_lot,
        visibility: updatedCard.visibility,
        awareness: updatedCard.awareness,
        household_income: updatedCard.household_income,
        size_tsubo: updatedCard.size_tsubo,
        car_capacity: updatedCard.car_capacity,
        wipe_spaces: updatedCard.wipe_spaces,
        pop_1km: updatedCard.pop_1km,
        pop_2km: updatedCard.pop_2km,
        pop_5km: updatedCard.pop_5km,
        lat,
        lng,
      })
      refetch() // データを再取得
    } catch (error) {
      console.error("カード更新エラー:", error)
      alert("カードの更新に失敗しました: " + (error instanceof Error ? error.message : "不明なエラー"))
    }
  }

  const handleCardDoubleClick = (card: CardType) => {
    setSelectedCard(card)
    setDialogOpen(true)
  }

  const handleDragStart = (card: CardType, fromListId: string) => {
    setDraggedCard(card)
    setDraggedFromList(fromListId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleListDragOver = (e: React.DragEvent, listId: string) => {
    e.preventDefault()
    setDragOverList(listId)
  }

  const handleListDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverList(null)
    }
  }

  const handleCardDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCard(cardId)
  }

  const handleCardDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCard(null)
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
    setDraggedFromList(null)
    setDragOverList(null)
    setDragOverCard(null)
  }

  const handleCardDrop = async (e: React.DragEvent, targetCard: CardType, targetListId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedCard || !draggedFromList) return

    try {
      if (draggedFromList === targetListId) {
        // 同じリスト内での順序変更
        await swapCards(draggedCard.id, targetCard.id)
      } else {
        // 異なるリスト間の移動
        await moveCard(draggedCard.id, targetListId, targetCard.position)
      }
      refetch() // データを再取得
    } catch (error) {
      console.error("カード移動エラー:", error)
    }

    handleDragEnd()
  }

  const handleDrop = async (e: React.DragEvent, toListId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedCard || !draggedFromList) return

    if (draggedFromList === toListId) {
      handleDragEnd()
      return
    }

    try {
      const cardCount = await getCardCount(toListId)
      await moveCard(draggedCard.id, toListId, cardCount)
      refetch() // データを再取得
    } catch (error) {
      console.error("カード移動エラー:", error)
    }

    handleDragEnd()
  }

  const getListColor = (listTitle: string) => {
    switch (listTitle) {
      case "完了":
        return "bg-red-100"
      case "Aヨミ":
        return "bg-green-100"
      case "Bヨミ":
        return "bg-blue-100"
      case "Cヨミ":
        return "bg-orange-100"
      case "未確定":
        return "bg-gray-100"
      default:
        return "bg-gray-100"
    }
  }

  const handleDeleteClick = (cardId: string, listId: string) => {
    setCardToDelete({ cardId, listId })
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return

    try {
      console.log("カード削除開始:", cardToDelete.cardId)
      await deleteCard(cardToDelete.cardId)
      console.log("カード削除成功")
      refetch() // データを再取得
    } catch (error) {
      console.error("カード削除エラー:", error)
      alert("カードの削除に失敗しました: " + (error instanceof Error ? error.message : "不明なエラー"))
    }

    setDeleteConfirmOpen(false)
    setCardToDelete(null)
  }

  const cancelDelete = () => {
    setDeleteConfirmOpen(false)
    setCardToDelete(null)
  }

  return (
    <div className="min-h-screen bg-yellow-400 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-yellow-500 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/sprello-logo.png" alt="Sprello Logo" width={40} height={40} className="rounded-lg" />
              <h1 className="text-2xl font-bold">{board.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "board" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("board")}
                className={viewMode === "board" ? "bg-yellow-600 hover:bg-yellow-700" : "hover:bg-yellow-600"}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                ボード
              </Button>
              <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("timeline")}
                className={viewMode === "timeline" ? "bg-yellow-600 hover:bg-yellow-700" : "hover:bg-yellow-600"}
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                タイムライン
              </Button>
              <Button
                variant={viewMode === "map" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className={viewMode === "map" ? "bg-yellow-600 hover:bg-yellow-700" : "hover:bg-yellow-600"}
              >
                <MapIcon className="w-4 h-4 mr-2" />
                マップ
              </Button>
              <div className="w-px h-6 bg-yellow-300 mx-1" />
              <Button
                size="sm"
                onClick={() => setProjectFormOpen(true)}
                className="bg-white text-yellow-700 hover:bg-yellow-50 font-semibold"
              >
                <Plus className="w-4 h-4 mr-1" />
                新規プロジェクト
              </Button>
            </div>
          </div>
        </div>

        {/* Board Content */}
        {viewMode === "board" ? (
          <div className="flex-1 p-2 sm:p-4 overflow-x-auto min-h-0">
            <div className="flex gap-2 sm:gap-4 min-h-full">
              {/* Lists */}
              {board.lists.map((list) => (
                <div
                  key={list.id}
                  className={`w-80 min-w-80 sm:w-72 ${getListColor(list.title)} rounded-lg p-3 flex flex-col flex-shrink-0 transition-all duration-200 ${
                    dragOverList === list.id ? "ring-2 ring-blue-400 ring-opacity-75 shadow-lg scale-105" : ""
                  } ${draggedCard ? "cursor-pointer" : ""}`}
                  onDragOver={(e) => handleListDragOver(e, list.id)}
                  onDragLeave={handleListDragLeave}
                  onDrop={(e) => handleDrop(e, list.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800">{list.title}</h3>
                      <span className="bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {list.cards.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-visible">
                    {list.cards.map((card) => (
                      <Card
                        key={card.id}
                        className={`p-3 bg-white shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 ${
                          draggedCard?.id === card.id ? "opacity-50 rotate-2 scale-105" : ""
                        } ${
                          dragOverCard === card.id && draggedCard?.id !== card.id
                            ? "border-2 border-blue-400 border-dashed"
                            : ""
                        }`}
                        draggable
                        onDragStart={() => handleDragStart(card, list.id)}
                        onDragEnd={handleDragEnd}
                        onDoubleClick={() => handleCardDoubleClick(card)}
                        onDragOver={(e) => handleCardDragOver(e, card.id)}
                        onDragLeave={handleCardDragLeave}
                        onDrop={(e) => handleCardDrop(e, card, list.id)}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-gray-800 flex-1">{card.title}</p>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <Edit
                              className="w-3 h-3 text-gray-400 cursor-pointer hover:text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCardDoubleClick(card)
                              }}
                            />
                            <Trash2
                              className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(card.id, list.id)
                              }}
                            />
                          </div>
                        </div>

                        {/* ArmBox: カテゴリ・ランク・住所 */}
                        {(card.category || card.rank || card.address || card.brand) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {card.category && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                style={{
                                  backgroundColor:
                                    CATEGORY_COLORS[(card.category as ProjectCategory)] ?? "#6b7280",
                                }}
                              >
                                {card.category}
                              </span>
                            )}
                            {card.rank && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                ランク{card.rank}
                              </span>
                            )}
                            {card.brand && (
                              <span className="text-[10px] text-gray-500">{card.brand}</span>
                            )}
                          </div>
                        )}
                        {card.address && (
                          <div className="mt-1 flex items-start gap-1 text-[11px] text-gray-500">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{card.address}</span>
                          </div>
                        )}
                        {(card.pop_1km != null || card.pop_2km != null || card.pop_5km != null) && (
                          <div className="mt-1 text-[10px] text-gray-400">
                            商圏 1/2/5km:{" "}
                            {[card.pop_1km, card.pop_2km, card.pop_5km]
                              .map((p) => (p != null ? Number(p).toLocaleString() : "-"))
                              .join(" / ")}
                          </div>
                        )}

                        {/* Status and Date Information */}
                        <div className="mt-2 space-y-1">
                          {card.status && (
                            <div>
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                {card.status}
                              </span>
                            </div>
                          )}
                          {card.open_date && (
                            <div>
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                OPEN:{" "}
                                {new Date(card.open_date).toLocaleDateString("ja-JP", {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                })}
                                予定
                              </span>
                            </div>
                          )}
                          {card.start_date && (
                            <div>
                              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                                着工:{" "}
                                {new Date(card.start_date).toLocaleDateString("ja-JP", {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                })}
                                予定
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Company Name if available */}
                        {card.company_name && (
                          <div className="mt-1">
                            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                              {card.company_name}
                            </span>
                          </div>
                        )}
                        {/* URL Links if available */}
                        {(card.candidate_url || card.candidate_url2 || card.company_url) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {card.company_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(card.company_url, '_blank', 'noopener,noreferrer')
                                }}
                                className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-1"
                                title="企業サイトを開く"
                              >
                                <ExternalLink className="w-3 h-3" />
                                企業
                              </button>
                            )}
                            {card.candidate_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(card.candidate_url, '_blank', 'noopener,noreferrer')
                                }}
                                className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full hover:bg-teal-200 transition-colors flex items-center gap-1"
                                title="候補地1を開く"
                              >
                                <ExternalLink className="w-3 h-3" />
                                候補地1
                              </button>
                            )}
                            {card.candidate_url2 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(card.candidate_url2, '_blank', 'noopener,noreferrer')
                                }}
                                className="bg-cyan-100 text-cyan-800 text-xs px-2 py-1 rounded-full hover:bg-cyan-200 transition-colors flex items-center gap-1"
                                title="候補地2を開く"
                              >
                                <ExternalLink className="w-3 h-3" />
                                候補地2
                              </button>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                    {/* Empty Drop Zone for lists with no cards */}
                    {list.cards.length === 0 && draggedCard && (
                      <div
                        className={`h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 transition-all duration-200 ${
                          dragOverList === list.id ? "border-blue-400 bg-blue-50" : ""
                        }`}
                        onDragOver={(e) => handleListDragOver(e, list.id)}
                        onDragLeave={handleListDragLeave}
                        onDrop={(e) => handleDrop(e, list.id)}
                      >
                        ここにドロップ
                      </div>
                    )}
                  </div>

                  {/* Add Card */}
                  <div className="mt-2">
                    {showAddCard === list.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="カードのタイトルを入力..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              addCard(list.id)
                            } else if (e.key === "Escape") {
                              setShowAddCard(null)
                              setNewCardTitle("")
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => addCard(list.id)}
                            className="bg-yellow-500 hover:bg-yellow-600"
                          >
                            カードを追加
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowAddCard(null)
                              setNewCardTitle("")
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-gray-600 hover:bg-gray-200"
                        onClick={() => setShowAddCard(list.id)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        カードを追加
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "timeline" ? (
          <div className="flex-1 p-2 sm:p-4 overflow-x-auto min-h-0 bg-white">
            <TimelineView board={board} />
          </div>
        ) : (
          <div className="bg-white" style={{ height: "calc(100vh - 72px)" }}>
            <MapView cards={board.lists.flatMap((l) => l.cards)} />
          </div>
        )}
      </div>

      {/* Card Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>タスク詳細</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  value={selectedCard.title}
                  onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                />
              </div>

              {/* ArmBox 出店データ */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-800">出店データ（地図・商圏）</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">カテゴリ</Label>
                    <Select
                      value={selectedCard.category ?? "自社店舗"}
                      onValueChange={(val) =>
                        setSelectedCard({ ...selectedCard, category: val as ProjectCategory })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">店舗名</Label>
                    <Input
                      value={selectedCard.store_name ?? ""}
                      onChange={(e) => setSelectedCard({ ...selectedCard, store_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">ブランド名</Label>
                    <Input
                      value={selectedCard.brand ?? ""}
                      onChange={(e) => setSelectedCard({ ...selectedCard, brand: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">ランク</Label>
                    <Input
                      value={selectedCard.rank ?? ""}
                      onChange={(e) => setSelectedCard({ ...selectedCard, rank: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-600">住所（保存時に地図ピンを更新）</Label>
                    <Input
                      value={selectedCard.address ?? ""}
                      placeholder="群馬県太田市新田野井町3-1"
                      onChange={(e) =>
                        setSelectedCard({
                          ...selectedCard,
                          address: e.target.value,
                          // 住所を変えたらジオコーディングし直すため緯度経度をクリア
                          lat: null,
                          lng: null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">1km人口</Label>
                    <Input
                      type="number"
                      value={selectedCard.pop_1km?.toString() ?? ""}
                      onChange={(e) =>
                        setSelectedCard({
                          ...selectedCard,
                          pop_1km: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">2km人口</Label>
                    <Input
                      type="number"
                      value={selectedCard.pop_2km?.toString() ?? ""}
                      onChange={(e) =>
                        setSelectedCard({
                          ...selectedCard,
                          pop_2km: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">5km人口</Label>
                    <Input
                      type="number"
                      value={selectedCard.pop_5km?.toString() ?? ""}
                      onChange={(e) =>
                        setSelectedCard({
                          ...selectedCard,
                          pop_5km: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">現在のステータス</Label>
                <div className="flex gap-2 mt-1">
                  <Select
                    value={selectedCard.status}
                    onValueChange={(value) => setSelectedCard({ ...selectedCard, status: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="ステータスを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setShowAddStatus(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Add Status Option */}
                {showAddStatus && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="新しいステータスを入力..."
                      value={newStatusOption}
                      onChange={(e) => setNewStatusOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addStatusOption()
                        } else if (e.key === "Escape") {
                          setShowAddStatus(false)
                          setNewStatusOption("")
                        }
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={addStatusOption}>
                      追加
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddStatus(false)
                        setNewStatusOption("")
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Memo */}
              <div>
                <Label htmlFor="memo">メモ</Label>
                <Textarea
                  id="memo"
                  placeholder="詳細なメモを入力してください..."
                  value={selectedCard.memo}
                  onChange={(e) => setSelectedCard({ ...selectedCard, memo: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="openDate">OPEN日</Label>
                  <div className="relative">
                    <Input
                      id="openDate"
                      type="date"
                      value={selectedCard.open_date || ""}
                      onChange={(e) => setSelectedCard({ ...selectedCard, open_date: e.target.value || null })}
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="startDate">着工日</Label>
                  <div className="relative">
                    <Input
                      id="startDate"
                      type="date"
                      value={selectedCard.start_date || ""}
                      onChange={(e) => setSelectedCard({ ...selectedCard, start_date: e.target.value || null })}
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">取引先企業様情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">企業様名</Label>
                    <Input
                      id="companyName"
                      placeholder="株式会社○○"
                      value={selectedCard.company_name}
                      onChange={(e) => setSelectedCard({ ...selectedCard, company_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyUrl">企業URL</Label>
                    <Input
                      id="companyUrl"
                      type="url"
                      placeholder="https://company.example.com"
                      value={selectedCard.company_url}
                      onChange={(e) => setSelectedCard({ ...selectedCard, company_url: e.target.value })}
                    />
                    {/* 企業URLの下に */}
                    {selectedCard.company_url && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => window.open(selectedCard.company_url, '_blank', 'noopener,noreferrer')}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          企業サイトを開く
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidate URLs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">候補地情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="candidateUrl">候補地URL 1</Label>
                    <Input
                      id="candidateUrl"
                      type="url"
                      placeholder="https://example.com"
                      value={selectedCard.candidate_url}
                      onChange={(e) => setSelectedCard({ ...selectedCard, candidate_url: e.target.value })}
                    />
                    {/* 候補地URL 1の下に */}
                    {selectedCard.candidate_url && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => window.open(selectedCard.candidate_url, '_blank', 'noopener,noreferrer')}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          リンクを開く
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="candidateUrl2">候補地URL 2</Label>
                    <Input
                      id="candidateUrl2"
                      type="url"
                      placeholder="https://example.com"
                      value={selectedCard.candidate_url2}
                      onChange={(e) => setSelectedCard({ ...selectedCard, candidate_url2: e.target.value })}
                    />
                    {/* 候補地URL 2の下に */}
                    {selectedCard.candidate_url2 && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => window.open(selectedCard.candidate_url2, '_blank', 'noopener,noreferrer')}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          リンクを開く
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={() => {
                    handleUpdateCard(selectedCard)
                    setDialogOpen(false)
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600"
                >
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カードを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消すことができません。カードとその中のすべての情報が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCard} className="bg-red-600 hover:bg-red-700">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新規プロジェクト作成フォーム */}
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        onSubmit={handleCreateProject}
        submitting={creatingProject}
      />
    </div>
  )
}
