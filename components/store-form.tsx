"use client"

import { useEffect, useState } from "react"
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
import type { Store } from "@/types/database"
import { geocodeAddress, fetchPopulation } from "@/lib/database-operations"

const RANK_OPTIONS = ["S", "A", "A-", "B", "B-", "C", "D"]
const STATUS_OPTIONS = ["検討中", "計画中", "オープン", "閉店", "見送り"]
const LOCATION_TYPES = ["ロードサイド", "駅前", "住宅街", "商業施設内", "その他"]

// モジュールスコープの数値入力（インライン定義だと入力ごとにフォーカスが外れるため外出し）
function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null | undefined
  onChange: (n: number | null) => void
}) {
  return (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type="number"
        value={value?.toString() ?? ""}
        onChange={(e) => {
          const s = e.target.value
          if (s === "") return onChange(null)
          const n = Number(s.replace(/,/g, ""))
          onChange(Number.isFinite(n) ? n : null)
        }}
      />
    </div>
  )
}

interface Props {
  store: Store | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (id: string, patch: Partial<Store>) => Promise<void>
  submitting?: boolean
}

export function StoreForm({ store, open, onOpenChange, onSubmit, submitting }: Props) {
  const [v, setV] = useState<Partial<Store>>({})
  const [fetchingPop, setFetchingPop] = useState(false)

  useEffect(() => {
    if (store) setV(store)
  }, [store])

  const autoPopulation = async () => {
    if (v.latitude == null || v.longitude == null) {
      alert("緯度経度が無いため取得できません（住所を保存してピンが立ってから実行してください）")
      return
    }
    setFetchingPop(true)
    try {
      const pop = await fetchPopulation(v.latitude, v.longitude)
      if (!pop) {
        alert("人口の取得に失敗しました。コンソールの [fetchPopulation] を確認してください。")
        return
      }
      set({ pop_1km: pop.pop_1km, pop_2km: pop.pop_2km, pop_5km: pop.pop_5km })
    } finally {
      setFetchingPop(false)
    }
  }

  const set = (patch: Partial<Store>) => setV((prev) => ({ ...prev, ...patch }))

  if (!store) return null

  const handleSubmit = async () => {
    const patch: Partial<Store> = { ...v }
    // 住所を変更したら座標を取り直す
    if (v.address && v.address !== store.address) {
      const geo = await geocodeAddress(v.address)
      if (geo.lat != null && geo.lng != null) {
        patch.latitude = geo.lat
        patch.longitude = geo.lng
      }
    }
    await onSubmit(store.id, patch)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store.store_name}｜出店データ入力</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">基本情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600">店舗名</Label>
                <Input value={v.store_name ?? ""} onChange={(e) => set({ store_name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-600">住所（変更すると地図ピンも更新）</Label>
                <Input value={v.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">電話番号</Label>
                <Input value={v.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600">立地タイプ</Label>
                <Select value={v.location_type ?? ""} onValueChange={(val) => set({ location_type: val })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">開店日</Label>
                <Input type="date" value={v.open_date ?? ""} onChange={(e) => set({ open_date: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">ランク</Label>
                <Select value={v.rank ?? ""} onValueChange={(val) => set({ rank: val })}>
                  <SelectTrigger><SelectValue placeholder="S" /></SelectTrigger>
                  <SelectContent>
                    {RANK_OPTIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">ステータス</Label>
                <Select value={v.status ?? ""} onValueChange={(val) => set({ status: val })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">評価・分析指標</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumField label="日中12時間交通量" value={v.traffic_12h} onChange={(n) => set({ traffic_12h: n })} />
              <NumField label="周辺充実度" value={v.surrounding_score} onChange={(n) => set({ surrounding_score: n })} />
              <NumField label="通過速度" value={v.passing_speed} onChange={(n) => set({ passing_speed: n })} />
              <NumField label="認知度" value={v.awareness} onChange={(n) => set({ awareness: n })} />
              <NumField label="世帯年収（万円）" value={v.household_income} onChange={(n) => set({ household_income: n })} />
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={!!v.corner_lot} onCheckedChange={(c) => set({ corner_lot: c })} id="s-corner" />
                <Label htmlFor="s-corner" className="text-xs text-gray-600">角地</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={!!v.visibility} onCheckedChange={(c) => set({ visibility: c })} id="s-vis" />
                <Label htmlFor="s-vis" className="text-xs text-gray-600">視認性</Label>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-1">物件スペック</h3>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="広さ（坪）" value={v.size_tsubo} onChange={(n) => set({ size_tsubo: n })} />
              <NumField label="何台並べるか" value={v.car_capacity} onChange={(n) => set({ car_capacity: n })} />
              <NumField label="拭上げスペース数" value={v.wipe_spaces} onChange={(n) => set({ wipe_spaces: n })} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-gray-800">商圏人口（同心円・住基/国勢）</h3>
              <Button size="sm" variant="outline" onClick={autoPopulation} disabled={fetchingPop}>
                {fetchingPop ? "取得中..." : "e-Statから取得"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="1.0km人口" value={v.pop_1km} onChange={(n) => set({ pop_1km: n })} />
              <NumField label="2.0km人口" value={v.pop_2km} onChange={(n) => set({ pop_2km: n })} />
              <NumField label="5.0km人口" value={v.pop_5km} onChange={(n) => set({ pop_5km: n })} />
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
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
