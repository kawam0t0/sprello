"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PROJECT_CATEGORIES } from "@/types/database"
import type { Card, ProjectCategory } from "@/types/database"

// 新規プロジェクト作成フォームで扱う項目
export type ProjectFormValues = Partial<Card> & { title: string }

const EMPTY: ProjectFormValues = {
  title: "",
  category: "スプラッシュンゴー",
  district: "",
  property_no: "",
  brand: "",
  store_name: "",
  location_type: "",
  open_date: null,
  prefecture: "",
  address: "",
  candidate_url: "",
  rank: "",
  status: "",
  traffic_12h: null,
  surrounding_score: null,
  passing_speed: null,
  corner_lot: false,
  visibility: false,
  awareness: null,
  household_income: null,
  size_tsubo: null,
  car_capacity: null,
  wipe_spaces: null,
  pop_1km: null,
  pop_2km: null,
  pop_5km: null,
}

const RANK_OPTIONS = ["S", "A", "A-", "B", "B-", "C", "D"]
const LOCATION_TYPES = ["ロードサイド", "駅前", "住宅街", "商業施設内", "その他"]

// モジュールスコープのテキスト入力（インライン定義だと入力ごとにフォーカスが外れるため外出し）
function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (s: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (values: ProjectFormValues) => Promise<void>
  initial?: ProjectFormValues
  submitting?: boolean
}

export function ProjectForm({ open, onOpenChange, onSubmit, initial, submitting }: Props) {
  const [v, setV] = useState<ProjectFormValues>(initial ?? EMPTY)

  const set = (patch: Partial<ProjectFormValues>) => setV((prev) => ({ ...prev, ...patch }))

  // 数値入力ヘルパー
  const num = (s: string): number | null => {
    if (s === "" || s == null) return null
    const n = Number(s.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
  }

  const handleSubmit = async () => {
    // 店舗名があればタイトルに反映（無ければ物件番号 → 住所）
    const title =
      (v.store_name && v.store_name.trim()) ||
      (v.property_no && v.property_no.trim()) ||
      (v.title && v.title.trim()) ||
      (v.address && v.address.trim()) ||
      "新規プロジェクト"
    await onSubmit({ ...v, title })
    setV(EMPTY)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規プロジェクト</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">基本情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600">カテゴリ</Label>
                <Select
                  value={v.category ?? "自社店舗"}
                  onValueChange={(val) => set({ category: val as ProjectCategory })}
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
              <TextField
                label="店舗名"
                value={v.store_name ?? ""}
                onChange={(s) => set({ store_name: s })}
                placeholder="太田新田店"
              />
              <div>
                <Label className="text-xs text-gray-600">立地タイプ</Label>
                <Select
                  value={v.location_type ?? ""}
                  onValueChange={(val) => set({ location_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField
                label="開店日"
                type="date"
                value={v.open_date ?? ""}
                onChange={(s) => set({ open_date: s || null })}
              />
              <TextField
                label="都道府県"
                value={v.prefecture ?? ""}
                onChange={(s) => set({ prefecture: s })}
                placeholder="群馬県"
              />
            </div>
            <TextField
              label="候補地URL（GoogleマップURL）※この場所が店舗の位置になります"
              value={v.candidate_url ?? ""}
              onChange={(s) => set({ candidate_url: s })}
              placeholder="https://maps.app.goo.gl/... または https://www.google.com/maps/...@36.37,139.08..."
            />
          </section>

          {/* 評価・分析指標 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">評価・分析指標</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-gray-600">ランク</Label>
                <Select value={v.rank ?? ""} onValueChange={(val) => set({ rank: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="S" />
                  </SelectTrigger>
                  <SelectContent>
                    {RANK_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField
                label="日中12時間交通量"
                type="number"
                value={v.traffic_12h?.toString() ?? ""}
                onChange={(s) => set({ traffic_12h: num(s) })}
              />
              <TextField
                label="周辺充実度"
                type="number"
                value={v.surrounding_score?.toString() ?? ""}
                onChange={(s) => set({ surrounding_score: num(s) })}
              />
              <TextField
                label="通過速度"
                type="number"
                value={v.passing_speed?.toString() ?? ""}
                onChange={(s) => set({ passing_speed: num(s) })}
              />
              <TextField
                label="認知度"
                type="number"
                value={v.awareness?.toString() ?? ""}
                onChange={(s) => set({ awareness: num(s) })}
              />
              <TextField
                label="世帯年収（万円）"
                type="number"
                value={v.household_income?.toString() ?? ""}
                onChange={(s) => set({ household_income: num(s) })}
              />
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={!!v.corner_lot}
                  onCheckedChange={(c) => set({ corner_lot: c })}
                  id="corner"
                />
                <Label htmlFor="corner" className="text-xs text-gray-600">
                  角地
                </Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={!!v.visibility}
                  onCheckedChange={(c) => set({ visibility: c })}
                  id="vis"
                />
                <Label htmlFor="vis" className="text-xs text-gray-600">
                  視認性
                </Label>
              </div>
            </div>
          </section>

          {/* 物件スペック */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">物件スペック</h3>
            <div className="grid grid-cols-3 gap-3">
              <TextField
                label="広さ（坪）"
                type="number"
                value={v.size_tsubo?.toString() ?? ""}
                onChange={(s) => set({ size_tsubo: num(s) })}
              />
              <TextField
                label="何台並べるか"
                type="number"
                value={v.car_capacity?.toString() ?? ""}
                onChange={(s) => set({ car_capacity: num(s) })}
              />
              <TextField
                label="拭上げスペース数"
                type="number"
                value={v.wipe_spaces?.toString() ?? ""}
                onChange={(s) => set({ wipe_spaces: num(s) })}
              />
            </div>
          </section>

          {/* 商圏人口 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">
              商圏人口（同心円・住基）
              <span className="ml-2 text-xs font-normal text-gray-400">
                ※空欄ならe-Stat連携後に自動集計されます
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <TextField
                label="1.0km人口総数"
                type="number"
                value={v.pop_1km?.toString() ?? ""}
                onChange={(s) => set({ pop_1km: num(s) })}
              />
              <TextField
                label="2.0km人口総数"
                type="number"
                value={v.pop_2km?.toString() ?? ""}
                onChange={(s) => set({ pop_2km: num(s) })}
              />
              <TextField
                label="5.0km人口総数"
                type="number"
                value={v.pop_5km?.toString() ?? ""}
                onChange={(s) => set({ pop_5km: num(s) })}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#1b4da0] hover:bg-[#163f85]"
          >
            {submitting ? "作成中..." : "プロジェクトを作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
