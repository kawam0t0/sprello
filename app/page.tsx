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
import { Switch } from "@/components/ui/switch"
import { TimelineView } from "@/components/timeline-view"
import { MapView } from "@/components/map-view"
import { ProjectForm, type ProjectFormValues } from "@/components/project-form"
import { ProjectCard } from "@/components/project-card"
import { StoresView } from "@/components/stores-view"

// Supabase関連のimport
import { useBoardData } from "@/hooks/use-board-data"
import { createCard, updateCard, deleteCard, moveCard, swapCards, getCardCount, createProject, geocodeAddress, upsertStoreFromCard, fetchPopulation, fetchSheetSpec, fetchTraffic, uploadDrawing } from "@/lib/database-operations"
import { CATEGORY_COLORS, PROJECT_CATEGORIES, normalizeCategory } from "@/types/database"
import { resolveLatLngFromUrl } from "@/lib/maps-url"
import type { Card as CardType, ProjectCategory } from "@/types/database"

// 段階（ヨミ）の並び順：OPEN→工事中→設営中→契約済→Aヨミ→Bヨミ→Cヨミ→Dヨミ
function yomiRank(title: string): number {
  const t = title || ""
  if (t.includes("OPEN") || t.includes("完了")) return 1
  if (t.includes("工事")) return 2
  if (t.includes("設営")) return 3
  if (t.includes("契約")) return 4
  if (t.includes("Aヨミ")) return 5
  if (t.includes("Bヨミ")) return 6
  if (t.includes("Cヨミ")) return 7
  if (t.includes("Dヨミ") || t.includes("未確定")) return 8
  return 9
}

export default function Home() {
  // Supabaseからデータを取得
  const { board, loading, error, refetch } = useBoardData()

  const [viewMode, setViewMode] = useState<"board" | "timeline" | "map" | "stores">("board")

  // ボードのヨミ絞り込み（"all" or list.id）
  const [yomiFilter, setYomiFilter] = useState<string>("all")

  // 新規プロジェクト作成フォーム
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [fetchingCardPop, setFetchingCardPop] = useState(false)
  const [fetchingSpec, setFetchingSpec] = useState(false)
  const [fetchingTraffic, setFetchingTraffic] = useState(false)
  const [uploadingDrawing, setUploadingDrawing] = useState(false)

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
      <div className="h-screen bg-[#1b4da0] flex flex-col items-center justify-center">
        <div className="text-white text-xl mb-4">読み込み中...</div>
      </div>
    )
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="h-screen bg-[#1b4da0] flex flex-col items-center justify-center">
        <div className="text-red-600 text-xl mb-4">エラー: {error}</div>
        <Button onClick={refetch} className="bg-[#1b4da0] hover:bg-[#163f85]">
          再試行
        </Button>
      </div>
    )
  }

  // ボードデータがない場合
  if (!board) {
    return (
      <div className="h-screen bg-[#1b4da0] flex flex-col items-center justify-center">
        <div className="text-white text-xl mb-4">ボードが見つかりません</div>
        <Button onClick={refetch} className="bg-[#1b4da0] hover:bg-[#163f85]">
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

  const handleUpdateCard = async (updatedCard: CardType) => {
    try {
      // ピン座標：候補地URL（GoogleマップURL）を最優先。無ければ住所からジオコーディング。
      let lat = updatedCard.lat ?? null
      let lng = updatedCard.lng ?? null
      let resolved = false
      if (updatedCard.candidate_url) {
        const r = await resolveLatLngFromUrl(updatedCard.candidate_url)
        if (r) {
          lat = r.lat
          lng = r.lng
          resolved = true
        }
      }
      if (!resolved && updatedCard.address && (lat == null || lng == null)) {
        const geo = await geocodeAddress(updatedCard.address)
        lat = geo.lat
        lng = geo.lng
      }
      // 商圏人口の自動入力（座標が取れて、人口が未入力のときだけ）
      let pop_1km = updatedCard.pop_1km ?? null
      let pop_2km = updatedCard.pop_2km ?? null
      let pop_5km = updatedCard.pop_5km ?? null
      if (lat != null && lng != null && pop_1km == null) {
        const pop = await fetchPopulation(lat, lng)
        if (pop) {
          pop_1km = pop.pop_1km
          pop_2km = pop.pop_2km
          pop_5km = pop.pop_5km
        }
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
        spec_sheet_url: updatedCard.spec_sheet_url,
        drawings: updatedCard.drawings ?? null,
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
        pop_1km,
        pop_2km,
        pop_5km,
        lat,
        lng,
      })
      // OPEN段階のプロジェクトを編集した場合は自社店舗(stores)も同期
      const listTitle = board.lists.find((l) => l.id === updatedCard.list_id)?.title ?? ""
      if (listTitle.includes("OPEN")) {
        await upsertStoreFromCard({ ...updatedCard, lat, lng, pop_1km, pop_2km, pop_5km })
      }
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
      case "OPEN":
        return "bg-green-100"
      case "工事中":
        return "bg-cyan-100"
      case "設営中":
        return "bg-violet-100"
      case "契約済":
        return "bg-amber-100"
      case "Aヨミ":
        return "bg-blue-100"
      case "Bヨミ":
        return "bg-sky-100"
      case "Cヨミ":
        return "bg-orange-100"
      case "Dヨミ":
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
    <div className="min-h-screen bg-[#1b4da0] flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header（スクロールしても上部に固定） */}
        <div className="sticky top-0 z-40 bg-[#1b4da0] text-white p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/app-logo.png" alt="ロゴ" width={40} height={40} className="rounded-lg" />
              <h1 className="text-2xl font-bold">{board.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "board" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("board")}
                className={viewMode === "board" ? "bg-[#163f85] hover:bg-[#10305f]" : "hover:bg-[#163f85]"}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                ボード
              </Button>
              <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("timeline")}
                className={viewMode === "timeline" ? "bg-[#163f85] hover:bg-[#10305f]" : "hover:bg-[#163f85]"}
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                タイムライン
              </Button>
              <Button
                variant={viewMode === "map" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className={viewMode === "map" ? "bg-[#163f85] hover:bg-[#10305f]" : "hover:bg-[#163f85]"}
              >
                <MapIcon className="w-4 h-4 mr-2" />
                マップ
              </Button>
              <Button
                variant={viewMode === "stores" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("stores")}
                className={viewMode === "stores" ? "bg-[#163f85] hover:bg-[#10305f]" : "hover:bg-[#163f85]"}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                店舗一覧表
              </Button>
              <div className="w-px h-6 bg-white/30 mx-1" />
              <Button
                size="sm"
                onClick={() => setProjectFormOpen(true)}
                className="bg-white text-[#1b4da0] hover:bg-blue-50 font-semibold"
              >
                <Plus className="w-4 h-4 mr-1" />
                新規プロジェクト
              </Button>
            </div>
          </div>
        </div>

        {/* Board Content */}
        {viewMode === "board" ? (
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto min-h-0">
            {/* ヨミで絞り込み */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-sm text-gray-600 mr-1">ヨミで絞り込み:</span>
              <button
                onClick={() => setYomiFilter("all")}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  yomiFilter === "all"
                    ? "bg-[#1b4da0] text-white border-[#1b4da0]"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                全て ({board.lists.reduce((n, l) => n + l.cards.length, 0)})
              </button>
              {board.lists
                .filter((list) => !/設営|Dヨミ/.test(list.title))
                .map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setYomiFilter(list.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      yomiFilter === list.id
                        ? "bg-[#1b4da0] text-white border-[#1b4da0]"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {list.title} ({list.cards.length})
                  </button>
                ))}
            </div>

            {/* 追加順のカードグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {board.lists
                .filter((l) => yomiFilter === "all" || l.id === yomiFilter)
                .flatMap((l) => l.cards.map((c) => ({ card: c, listTitle: l.title })))
                .sort((a, b) => {
                  const yr = yomiRank(a.listTitle) - yomiRank(b.listTitle)
                  if (yr !== 0) return yr
                  // 同じヨミ内はOPEN日が近い順（未設定は末尾）
                  const ao = a.card.open_date ? new Date(a.card.open_date).getTime() : Infinity
                  const bo = b.card.open_date ? new Date(b.card.open_date).getTime() : Infinity
                  return ao - bo
                })
                .map(({ card }) => (
                  <ProjectCard
                    key={card.id}
                    card={card}
                    onOpen={handleCardDoubleClick}
                    onDelete={(id) => handleDeleteClick(id, card.list_id)}
                  />
                ))}
            </div>
          </div>
        ) : viewMode === "timeline" ? (
          <div className="flex-1 p-2 sm:p-4 overflow-x-auto min-h-0 bg-white">
            <TimelineView board={board} />
          </div>
        ) : viewMode === "map" ? (
          <div className="bg-white" style={{ height: "calc(100vh - 72px)" }}>
            <MapView cards={board.lists.flatMap((l) => l.cards.map((c) => ({ ...c, listTitle: l.title })))} />
          </div>
        ) : (
          <StoresView
            cards={board.lists.flatMap((l) => l.cards.map((c) => ({ ...c, listTitle: l.title })))}
            onRefetch={refetch}
          />
        )}
      </div>

      {/* Card Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
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

              {/* ヨミ（段階） */}
              <div>
                <Label htmlFor="yomi">ヨミ（段階）</Label>
                <Select
                  value={selectedCard.list_id}
                  onValueChange={async (val) => {
                    try {
                      const count = await getCardCount(val)
                      await moveCard(selectedCard.id, val, count)
                      const updated = { ...selectedCard, list_id: val }
                      setSelectedCard(updated)
                      // 「OPEN」に移したら自社店舗(stores)へ登録＝店舗一覧＆地図ピンに反映
                      const targetTitle = board.lists.find((l) => l.id === val)?.title ?? ""
                      if (targetTitle.includes("OPEN")) {
                        await upsertStoreFromCard(updated)
                      }
                      refetch()
                    } catch (err) {
                      console.error("ヨミ変更エラー:", err)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {board.lists
                      .filter((l) => !/設営|Dヨミ/.test(l.title))
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 候補地スペック取込（スプレッドシート「本部使用【候補地スペック】」） */}
              <div>
                <Label htmlFor="specSheet">候補地スペック取込（スプレッドシートURL）</Label>
                <div className="flex gap-2">
                  <Input
                    id="specSheet"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={selectedCard.spec_sheet_url ?? ""}
                    onChange={(e) => setSelectedCard({ ...selectedCard, spec_sheet_url: e.target.value })}
                  />
                  <Button
                    type="button"
                    className="flex-shrink-0 whitespace-nowrap bg-[#1b4da0] hover:bg-[#163f85]"
                    size="sm"
                    disabled={fetchingSpec}
                    onClick={async () => {
                      const url = (selectedCard.spec_sheet_url ?? "").trim()
                      if (!url) {
                        alert("先にスプレッドシートのURLを貼り付けてください")
                        return
                      }
                      setFetchingSpec(true)
                      try {
                        const r = await fetchSheetSpec(url)
                        if (r && r.found) {
                          const v = r.values
                          const next = { ...selectedCard }
                          if (v.store_name != null) next.store_name = v.store_name
                          if (v.size_tsubo != null) next.size_tsubo = v.size_tsubo
                          if (v.traffic_12h != null) next.traffic_12h = v.traffic_12h
                          if (v.household_income != null) next.household_income = v.household_income
                          if (v.passing_speed != null) next.passing_speed = v.passing_speed
                          if (v.surrounding_score != null) next.surrounding_score = v.surrounding_score
                          setSelectedCard(next)
                          const label: Record<string, string> = {
                            store_name: "店舗名",
                            size_tsubo: "坪数",
                            traffic_12h: "日中12時間交通量",
                            household_income: "世帯年収",
                            passing_speed: "通過速度",
                            surrounding_score: "周辺充実度",
                          }
                          alert(
                            "取得しました（保存を押すと確定します）:\n" +
                              r.filled.map((k) => `・${label[k] ?? k}`).join("\n"),
                          )
                        } else if (r && "message" in r) {
                          alert(r.message)
                        } else {
                          alert("取得に失敗しました。時間をおいて再度お試しください")
                        }
                      } finally {
                        setFetchingSpec(false)
                      }
                    }}
                  >
                    {fetchingSpec ? "取得中..." : "データ取得"}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  「本部使用【候補地スペック】」シートから 店舗名／坪数／交通量／世帯年収／通過速度／周辺充実度（＝消費施設充実度）を取り込みます
                </p>
              </div>

              {/* ArmBox 出店データ */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-800">出店データ（地図・商圏）</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">ブランド名</Label>
                    <Select
                      value={normalizeCategory(selectedCard.category)}
                      onValueChange={(val) =>
                        setSelectedCard({
                          ...selectedCard,
                          category: val as ProjectCategory,
                          // ブランド名＝カテゴリ。店舗マスターのbrandにも同じ値を反映
                          brand: val,
                        })
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
                    <Label className="text-xs text-gray-600">立地タイプ</Label>
                    <Select
                      value={selectedCard.location_type ?? ""}
                      onValueChange={(val) => setSelectedCard({ ...selectedCard, location_type: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {["ロードサイド", "駅前", "住宅街", "商業施設内", "その他"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 日中12時間交通量（道路交通センサスから最寄り区間を自動取得可） */}
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-600">日中12時間交通量</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={selectedCard.traffic_12h?.toString() ?? ""}
                        onChange={(e) =>
                          setSelectedCard({
                            ...selectedCard,
                            traffic_12h: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 whitespace-nowrap"
                        disabled={fetchingTraffic}
                        onClick={async () => {
                          if (selectedCard.lat == null || selectedCard.lng == null) {
                            alert("先に候補地URLを入れて保存し、ピンを立ててから取得してください")
                            return
                          }
                          setFetchingTraffic(true)
                          try {
                            const t = await fetchTraffic(selectedCard.lat, selectedCard.lng)
                            if (t && t.found) {
                              setSelectedCard({ ...selectedCard, traffic_12h: t.traffic_12h })
                              const dist = (t.distance_m / 1000).toFixed(1)
                              const veh = t.vehicle ?? "小型車(片側)"
                              const ud =
                                t.traffic_up != null && t.traffic_down != null
                                  ? `\n（上り ${Number(t.traffic_up).toLocaleString()} ／ 下り ${Number(t.traffic_down).toLocaleString()}）`
                                  : ""
                              const allTxt =
                                t.traffic_12h_all != null && veh.startsWith("小型車")
                                  ? `\n（参考：全車上下計 ${t.traffic_12h_all.toLocaleString()} 台）`
                                  : ""
                              alert(
                                `調査区間（${t.road_class} / 約${dist}km）の\n昼間12時間交通量【${veh}】: ${t.traffic_12h.toLocaleString()} 台 を入力しました${ud}${allTxt}\n（道路交通センサス 令和3年度）`,
                              )
                            } else if (t && "message" in t) {
                              alert(t.message)
                            } else {
                              alert("交通量の取得に失敗しました。時間をおいて再度お試しください")
                            }
                          } finally {
                            setFetchingTraffic(false)
                          }
                        }}
                      >
                        {fetchingTraffic ? "取得中..." : "自動取得"}
                      </Button>
                    </div>
                  </div>
                  {(
                    [
                      ["周辺充実度", "surrounding_score"],
                      ["通過速度", "passing_speed"],
                      ["世帯年収（万円）", "household_income"],
                      ["広さ（坪）", "size_tsubo"],
                    ] as [string, keyof CardType][]
                  ).map(([label, key]) => (
                    <div key={key as string}>
                      <Label className="text-xs text-gray-600">{label}</Label>
                      <Input
                        type="number"
                        value={(selectedCard[key] as number | null | undefined)?.toString() ?? ""}
                        onChange={(e) =>
                          setSelectedCard({
                            ...selectedCard,
                            [key]: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">商圏人口（国勢2020・保存時に自動入力）</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={fetchingCardPop}
                    onClick={async () => {
                      if (selectedCard.lat == null || selectedCard.lng == null) {
                        alert("先に候補地URLを入れて保存し、ピンを立ててから取得してください")
                        return
                      }
                      setFetchingCardPop(true)
                      try {
                        const pop = await fetchPopulation(selectedCard.lat, selectedCard.lng)
                        if (pop) {
                          setSelectedCard({
                            ...selectedCard,
                            pop_1km: pop.pop_1km,
                            pop_2km: pop.pop_2km,
                            pop_5km: pop.pop_5km,
                          })
                        } else {
                          alert("この地点の人口データが見つかりませんでした（対象県のCSV未取込かも）")
                        }
                      } finally {
                        setFetchingCardPop(false)
                      }
                    }}
                  >
                    {fetchingCardPop ? "取得中..." : "人口を取得"}
                  </Button>
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

              {/* Candidate URL（1本のみ・地図ピンの座標元） */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">候補地URL（店舗の位置）</h3>
                <div>
                  <Label htmlFor="candidateUrl" className="text-xs text-gray-600">
                    GoogleマップのURL。この場所が地図ピン＝店舗の位置になります（保存時に座標を取得）
                  </Label>
                  <Input
                    id="candidateUrl"
                    type="url"
                    placeholder="https://maps.app.goo.gl/... または https://www.google.com/maps/...@36.37,139.08..."
                    value={selectedCard.candidate_url}
                    onChange={(e) => setSelectedCard({ ...selectedCard, candidate_url: e.target.value })}
                  />
                  {selectedCard.candidate_url && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => window.open(selectedCard.candidate_url, "_blank", "noopener,noreferrer")}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        リンクを開く
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 資料 */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">資料</h3>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm cursor-pointer hover:bg-gray-50">
                    <Plus className="w-4 h-4" />
                    資料を追加
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      disabled={uploadingDrawing}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? [])
                        e.target.value = ""
                        if (!files.length || !selectedCard) return
                        setUploadingDrawing(true)
                        try {
                          const uploaded: { name: string; url: string }[] = []
                          for (const f of files) uploaded.push(await uploadDrawing(selectedCard.id, f))
                          setSelectedCard({
                            ...selectedCard,
                            drawings: [...(selectedCard.drawings ?? []), ...uploaded],
                          })
                        } catch (err) {
                          alert(
                            "資料のアップロードに失敗しました: " +
                              (err instanceof Error ? err.message : "不明なエラー") +
                              "\n（Supabaseに drawings バケットが未作成の可能性があります）",
                          )
                        } finally {
                          setUploadingDrawing(false)
                        }
                      }}
                    />
                  </label>
                  {uploadingDrawing && <span className="text-sm text-gray-500">アップロード中…</span>}
                  <span className="text-[11px] text-gray-400">画像・PDF・Excel等どんなファイルでもOK。保存を押すと確定します</span>
                </div>
                {(selectedCard.drawings ?? []).length > 0 && (
                  <ul className="space-y-1">
                    {(selectedCard.drawings ?? []).map((d, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                        >
                          {d.name}
                        </a>
                        <button
                          onClick={() =>
                            setSelectedCard({
                              ...selectedCard,
                              drawings: (selectedCard.drawings ?? []).filter((_, j) => j !== i),
                            })
                          }
                          className="text-gray-400 hover:text-red-600 flex-shrink-0"
                          title="外す"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                  className="bg-[#1b4da0] hover:bg-[#163f85]"
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
