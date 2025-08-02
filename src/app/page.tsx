"use client"

import type React from "react"

import { useState } from "react"
import { Plus, MoreHorizontal, X, Edit, Calendar, Trash2 } from "lucide-react"
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

interface CardType {
  id: string
  title: string
  status: string
  memo: string
  openDate: string
  startDate: string
  candidateUrl: string
  candidateUrl2: string
  companyName: string
  companyUrl: string
}

interface ListType {
  id: string
  title: string
  cards: CardType[]
}

interface BoardType {
  id: string
  title: string
  lists: ListType[]
}

export default function Home() {
  const [currentBoard, setCurrentBoard] = useState<BoardType>({
    id: "1",
    title: "Sprello",
    lists: [
      {
        id: "0",
        title: "完了",
        cards: [],
      },
      {
        id: "1",
        title: "Aヨミ",
        cards: [],
      },
      {
        id: "2",
        title: "Bヨミ",
        cards: [],
      },
      {
        id: "3",
        title: "Cヨミ",
        cards: [],
      },
      {
        id: "4",
        title: "未確定",
        cards: [],
      },
    ],
  })

  const [statusOptions, setStatusOptions] = useState(["見積待ち", "融資待ち", "補助金待ち", "社内稟議待ち"])
  const [newStatusOption, setNewStatusOption] = useState("")
  const [showAddStatus, setShowAddStatus] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState("")
  const [newListTitle, setNewListTitle] = useState("")
  const [showAddCard, setShowAddCard] = useState<string | null>(null)
  const [showAddList, setShowAddList] = useState(false)
  const [draggedCard, setDraggedCard] = useState<CardType | null>(null)
  const [draggedFromList, setDraggedFromList] = useState<string | null>(null)
  const [dragOverList, setDragOverList] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)

  // 削除確認ダイアログ用の状態
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [cardToDelete, setCardToDelete] = useState<{ cardId: string; listId: string } | null>(null)

  const addCard = (listId: string) => {
    if (!newCardTitle.trim()) return

    const newCard: CardType = {
      id: Date.now().toString(),
      title: newCardTitle,
      status: "",
      memo: "",
      openDate: "",
      startDate: "",
      candidateUrl: "",
      candidateUrl2: "",
      companyName: "",
      companyUrl: "",
    }

    setCurrentBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((list) => (list.id === listId ? { ...list, cards: [...list.cards, newCard] } : list)),
    }))

    setNewCardTitle("")
    setShowAddCard(null)
  }

  const addList = () => {
    if (!newListTitle.trim()) return

    const newList: ListType = {
      id: Date.now().toString(),
      title: newListTitle,
      cards: [],
    }

    setCurrentBoard((prev) => ({
      ...prev,
      lists: [...prev.lists, newList],
    }))

    setNewListTitle("")
    setShowAddList(false)
  }

  const addStatusOption = () => {
    if (!newStatusOption.trim() || statusOptions.includes(newStatusOption)) return

    setStatusOptions([...statusOptions, newStatusOption])
    setNewStatusOption("")
    setShowAddStatus(false)
  }

  const updateCard = (updatedCard: CardType) => {
    setCurrentBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((list) => ({
        ...list,
        cards: list.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
      })),
    }))
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
    // リストの境界を完全に出た場合のみリセット
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

  const handleCardDrop = (e: React.DragEvent, targetCard: CardType, targetListId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedCard || !draggedFromList) return

    setCurrentBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((list) => {
        if (list.id === draggedFromList && list.id === targetListId) {
          // 同じリスト内での順序変更 - 入れ替え処理
          const cards = [...list.cards]
          const draggedIndex = cards.findIndex((card) => card.id === draggedCard.id)
          const targetIndex = cards.findIndex((card) => card.id === targetCard.id)

          // 2つのカードの位置を入れ替え
          const temp = cards[draggedIndex]
          cards[draggedIndex] = cards[targetIndex]
          cards[targetIndex] = temp

          return { ...list, cards }
        } else if (list.id === draggedFromList) {
          // 元のリストからカードを削除
          return { ...list, cards: list.cards.filter((card) => card.id !== draggedCard.id) }
        } else if (list.id === targetListId) {
          // 新しいリストにカードを追加（異なるリスト間の移動）
          const cards = [...list.cards]
          const targetIndex = cards.findIndex((card) => card.id === targetCard.id)
          cards.splice(targetIndex, 0, draggedCard)
          return { ...list, cards }
        }
        return list
      }),
    }))

    handleDragEnd()
  }

  const handleDrop = (e: React.DragEvent, toListId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedCard || !draggedFromList) return

    // 同じリストの場合は何もしない（カードの順序変更は別の関数で処理）
    if (draggedFromList === toListId) {
      handleDragEnd()
      return
    }

    setCurrentBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((list) => {
        if (list.id === draggedFromList) {
          return {
            ...list,
            cards: list.cards.filter((card) => card.id !== draggedCard.id),
          }
        }
        if (list.id === toListId) {
          return {
            ...list,
            cards: [...list.cards, draggedCard],
          }
        }
        return list
      }),
    }))

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

  // 削除確認ダイアログを開く
  const handleDeleteClick = (cardId: string, listId: string) => {
    setCardToDelete({ cardId, listId })
    setDeleteConfirmOpen(true)
  }

  // 実際の削除処理
  const confirmDeleteCard = () => {
    if (!cardToDelete) return

    setCurrentBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((list) =>
        list.id === cardToDelete.listId
          ? { ...list, cards: list.cards.filter((card) => card.id !== cardToDelete.cardId) }
          : list,
      ),
    }))

    setDeleteConfirmOpen(false)
    setCardToDelete(null)
  }

  // 削除キャンセル
  const cancelDelete = () => {
    setDeleteConfirmOpen(false)
    setCardToDelete(null)
  }

  return (
    <div className="h-screen bg-yellow-400 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-yellow-500 text-white p-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <img src="/images/sprello-logo.png" alt="Sprello Logo" width={40} height={40} className="rounded-lg" />
              <h1 className="text-2xl font-bold">{currentBoard.title}</h1>
            </div>

            {/* Right side - can be used for user menu, settings, etc. */}
            <div className="flex items-center gap-2">{/* Placeholder for future features */}</div>
          </div>
        </div>

        {/* Board Content */}
        <div className="flex-1 p-2 sm:p-4 overflow-x-auto">
          <div className="flex gap-2 sm:gap-4 h-full">
            {/* Lists */}
            {currentBoard.lists.map((list) => (
              <div
                key={list.id}
                className={`w-80 min-w-80 sm:w-72 ${getListColor(list.title)} rounded-lg p-3 flex flex-col max-h-full flex-shrink-0 transition-all duration-200 ${
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

                <div className="flex-1 space-y-2 overflow-y-auto">
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

                      {/* Status and Date Information */}
                      <div className="mt-2 space-y-1">
                        {card.status && (
                          <div>
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                              {card.status}
                            </span>
                          </div>
                        )}
                        {card.openDate && (
                          <div>
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              OPEN:{" "}
                              {new Date(card.openDate).toLocaleDateString("ja-JP", {
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                              })}
                              予定
                            </span>
                          </div>
                        )}
                        {card.startDate && (
                          <div>
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                              着工:{" "}
                              {new Date(card.startDate).toLocaleDateString("ja-JP", {
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
                      {card.companyName && (
                        <div className="mt-1">
                          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                            {card.companyName}
                          </span>
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

            {/* Add List */}
            <div className="w-80 min-w-80 flex-shrink-0">
              {showAddList ? (
                <div className="bg-gray-100 rounded-lg p-3">
                  <Input
                    placeholder="リストのタイトルを入力..."
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addList()
                      } else if (e.key === "Escape") {
                        setShowAddList(false)
                        setNewListTitle("")
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={addList} className="bg-yellow-500 hover:bg-yellow-600">
                      リストを追加
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddList(false)
                        setNewListTitle("")
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start bg-white/20 text-white hover:bg-white/30 h-auto p-3"
                  onClick={() => setShowAddList(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  リストを追加
                </Button>
              )}
            </div>
          </div>
        </div>
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
                      value={selectedCard.openDate}
                      onChange={(e) => setSelectedCard({ ...selectedCard, openDate: e.target.value })}
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
                      value={selectedCard.startDate}
                      onChange={(e) => setSelectedCard({ ...selectedCard, startDate: e.target.value })}
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
                      value={selectedCard.companyName}
                      onChange={(e) => setSelectedCard({ ...selectedCard, companyName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyUrl">企業URL</Label>
                    <Input
                      id="companyUrl"
                      type="url"
                      placeholder="https://company.example.com"
                      value={selectedCard.companyUrl}
                      onChange={(e) => setSelectedCard({ ...selectedCard, companyUrl: e.target.value })}
                    />
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
                      value={selectedCard.candidateUrl}
                      onChange={(e) => setSelectedCard({ ...selectedCard, candidateUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="candidateUrl2">候補地URL 2</Label>
                    <Input
                      id="candidateUrl2"
                      type="url"
                      placeholder="https://example.com"
                      value={selectedCard.candidateUrl2}
                      onChange={(e) => setSelectedCard({ ...selectedCard, candidateUrl2: e.target.value })}
                    />
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
                    updateCard(selectedCard)
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
    </div>
  )
}
