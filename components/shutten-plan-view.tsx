"use client"

import { useMemo, useState } from "react"
import { Download, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateCard } from "@/lib/database-operations"
import { prefFromMuniCd } from "@/lib/jp-prefectures"
import type { Card } from "@/types/database"
import { normalizeCategory } from "@/types/database"

type CardWithList = Card & { listTitle?: string }

// 九州エリアの都道府県（この都道府県の店舗はブランドを「SPB九州」で表示）
const KYUSHU = new Set(["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県"])

// 住所から都道府県を抽出（prefecture未設定時のフォールバック）
function prefFromAddress(addr?: string | null): string {
  if (!addr) return ""
  const m = addr.match(/(東京都|北海道|京都府|大阪府|.{2,3}県)/)
  return m ? m[1] : ""
}
// カードの都道府県（フィールド → 住所から抽出）
function prefOf(c: CardWithList): string {
  return c.prefecture || prefFromAddress(c.address) || ""
}
// 表示ブランド：九州エリアは「SPB九州」、それ以外はブランド（無ければスプラッシュンゴー）
function brandOf(c: CardWithList): string {
  if (KYUSHU.has(prefOf(c))) return "SPB九州"
  // ブランド名はタスク詳細の「ブランド名」＝カテゴリ(category)が基準。
  // brandは手でプルダウンを変えたときだけ入るので、categoryを優先し補助にbrandを見る。
  return normalizeCategory(c.category ?? c.brand)
}

// YYYY-MM-DD → 「年」と、確定段階は「M月D日」、ヨミ段階(fuzzy)は「M月上旬/中旬/下旬」に分解
function fmtJun(s?: string | null, fuzzy = false): { y: string; md: string } | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  if (fuzzy) {
    const day = d.getDate()
    const jun = day <= 10 ? "上旬" : day <= 20 ? "中旬" : "下旬"
    return { y: `${d.getFullYear()}年`, md: `${d.getMonth() + 1}月${jun}` }
  }
  return { y: `${d.getFullYear()}年`, md: `${d.getMonth() + 1}月${d.getDate()}日` }
}

// A/B/C/Dヨミ（まだ確定前）の段階は日付を曖昧（上旬/中旬/下旬）に表示する
function isFuzzy(c: CardWithList): boolean {
  return (c.listTitle ?? "").includes("ヨミ")
}

// 並び順キー：OPEN→設営→着工のうち一番早い日付
function sortKey(c: CardWithList): number {
  const s = c.open_date || c.setup_date || c.start_date
  return s ? new Date(s).getTime() : Infinity
}

function DateCell({ s, fuzzy }: { s?: string | null; fuzzy?: boolean }) {
  const p = fmtJun(s, fuzzy)
  if (!p) return <span className="text-gray-300">—</span>
  return (
    <div className="leading-tight">
      <div className="text-[11px] text-gray-400">{p.y}</div>
      <div className="text-sm font-semibold text-gray-800">{p.md}</div>
    </div>
  )
}

function fmtAmount(n?: number | null): string {
  return n == null ? "" : `¥${n.toLocaleString()}`
}

// 入金セル：日付（年＋上旬/中旬/下旬）＋金額
function PayCell({ s, amt, fuzzy }: { s?: string | null; amt?: number | null; fuzzy?: boolean }) {
  const p = fmtJun(s, fuzzy)
  if (!p && amt == null) return <span className="text-gray-300">—</span>
  return (
    <div className="leading-tight">
      {p ? (
        <>
          <div className="text-[11px] text-gray-400">{p.y}</div>
          <div className="text-sm font-semibold text-gray-800">{p.md}</div>
        </>
      ) : (
        <div className="text-gray-300">—</div>
      )}
      {amt != null && <div className="text-[11px] font-semibold text-[#1b4da0]">{fmtAmount(amt)}</div>}
    </div>
  )
}

// 段階の並び順（ボードと同じ。設営中・Dヨミはボード同様に絞り込みへ出さない）
const STAGE_ORDER = ["OPEN", "工事中", "契約済", "Aヨミ", "Bヨミ", "Cヨミ", "Dヨミ"]
const stageRank = (t: string) => {
  const i = STAGE_ORDER.indexOf(t)
  return i === -1 ? STAGE_ORDER.length : i
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function ShuttenPlanView({
  cards = [],
  onRefetch,
}: {
  cards?: CardWithList[]
  onRefetch?: () => void
}) {
  const [selected, setSelected] = useState<string[]>([]) // 選択中の段階。空＝全て
  const [busy, setBusy] = useState(false)

  // 日付が1つ以上入っている案件だけ、早い順に。ヨミで絞り込み。
  const rows = useMemo(
    () =>
      cards
        .filter((c) => c.open_date || c.setup_date || c.start_date)
        .filter((c) => selected.length === 0 || selected.includes(c.listTitle ?? ""))
        .sort((a, b) => sortKey(a) - sortKey(b)),
    [cards, selected],
  )

  // 都道府県が空で、座標はある案件（自動取得の対象）
  const missingPref = useMemo(
    () => cards.filter((c) => !prefOf(c) && c.lat != null && c.lng != null),
    [cards],
  )

  // 絞り込みに出す段階（ボードと同じ。カードに存在する段階だけ、順番統一）
  const stageOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of cards) {
      const t = c.listTitle ?? ""
      if (t && !/設営/.test(t)) set.add(t)
    }
    return Array.from(set).sort((a, b) => stageRank(a) - stageRank(b))
  }, [cards])

  // 期間レンジ（最小月〜最大月）
  const range = useMemo(() => {
    const times = rows
      .flatMap((c) => [c.start_date, c.setup_date, c.open_date])
      .filter(Boolean)
      .map((s) => new Date(s as string).getTime())
      .filter((t) => !isNaN(t))
    if (!times.length) return ""
    const min = new Date(Math.min(...times))
    const max = new Date(Math.max(...times))
    return `${min.getFullYear()}年${min.getMonth() + 1}月 〜 ${max.getFullYear()}年${max.getMonth() + 1}月`
  }, [rows])

  const yomiLabel = selected.length === 0 ? "" : `（${selected.join("・")}）`

  // 都道府県を座標から自動取得（国土地理院の逆ジオコーダ）してDBへ保存
  const autoFillPref = async () => {
    if (!missingPref.length || busy) return
    setBusy(true)
    try {
      for (const c of missingPref) {
        try {
          const rg = await fetch(`/api/revgeo?lat=${c.lat}&lng=${c.lng}`).then((r) => r.json())
          const pref = prefFromMuniCd(rg?.muniCd)
          if (pref) await updateCard(c.id, { prefecture: pref })
        } catch {
          /* 1件失敗しても続行 */
        }
      }
      onRefetch?.()
    } finally {
      setBusy(false)
    }
  }

  // PDF（印刷）用のHTMLを別ウィンドウで開いて印刷 → ブラウザの「PDFとして保存」で保存できる
  const downloadPdf = () => {
    const win = window.open("", "_blank", "width=900,height=1200")
    if (!win) {
      alert("ポップアップがブロックされました。ポップアップを許可してください。")
      return
    }
    const body = rows
      .map((c) => {
        const pref = prefOf(c) || "—"
        const fuzzy = isFuzzy(c)
        const cell = (s?: string | null) => {
          const p = fmtJun(s, fuzzy)
          return p ? `<div class="y">${p.y}</div><div class="md">${p.md}</div>` : `<span class="dash">—</span>`
        }
        const payCell = (s?: string | null, amt?: number | null) => {
          const p = fmtJun(s, fuzzy)
          const d = p ? `<div class="y">${p.y}</div><div class="md">${p.md}</div>` : amt != null ? "" : `<span class="dash">—</span>`
          const a = amt != null ? `<div class="amt">¥${amt.toLocaleString()}</div>` : ""
          return d + a
        }
        return `<tr>
          <td class="brand">${esc(brandOf(c))}</td>
          <td class="pref">${esc(pref)}</td>
          <td class="name">${esc(c.store_name || c.title)}</td>
          <td class="date">${cell(c.start_date)}</td>
          <td class="date">${cell(c.setup_date)}</td>
          <td class="date">${cell(c.open_date)}</td>
          <td class="date">${payCell(c.payment1_date, c.payment1_amount)}</td>
          <td class="date">${payCell(c.payment2_date, c.payment2_amount)}</td>
        </tr>`
      })
      .join("")
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>出店予定表${yomiLabel}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif; color:#1f2937; margin:0; }
  .brandline { font-size:11px; font-weight:700; letter-spacing:.12em; color:#9ca3af; }
  h1 { font-size:26px; font-weight:900; margin:4px 0 2px; }
  .sub { font-size:12px; color:#6b7280; margin-bottom:14px; display:flex; justify-content:space-between; }
  table { width:100%; border-collapse:collapse; }
  thead th { background:#1b2b4b; color:#fff; font-size:11px; font-weight:700; padding:9px 10px; text-align:left; }
  thead th.c { text-align:center; }
  tbody td { border-top:1px solid #eef0f3; padding:9px 10px; font-size:12px; vertical-align:middle; }
  tbody tr:nth-child(even) { background:#f7f8fa; }
  td.brand { font-size:11px; font-weight:700; color:#4b5563; white-space:nowrap; }
  td.pref { font-weight:700; color:#374151; white-space:nowrap; }
  td.name { font-weight:600; color:#111827; }
  td.date { text-align:center; }
  td.date .y { font-size:10px; color:#9ca3af; }
  td.date .md { font-size:12px; font-weight:700; color:#1f2937; }
  td.date .dash { color:#d1d5db; }
  td.date .amt { font-size:10px; color:#1b4da0; font-weight:700; }
</style></head>
<body>
  <div class="brandline">スプラッシュンゴー</div>
  <h1>出店予定表${yomiLabel}</h1>
  <div class="sub"><span>${range}</span><span>全${rows.length}案件</span></div>
  <table>
    <thead><tr>
      <th>ブランド</th><th>都道府県</th><th>プロジェクト名</th>
      <th class="c">着工</th><th class="c">設営</th><th class="c">OPEN</th><th class="c">初回入金</th><th class="c">二回目入金</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
</body></html>`)
    win.document.close()
  }

  return (
    <div className="flex-1 overflow-auto bg-white p-4 sm:p-6">
      <div className="mb-4">
        <div className="text-xs font-bold tracking-wider text-gray-400">スプラッシュンゴー</div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-black text-gray-900">出店予定表{yomiLabel}</h2>
          <div className="text-sm text-gray-500">
            {range}
            {range && "　／　"}全{rows.length}案件
          </div>
        </div>
      </div>

      {/* 操作バー：ヨミ絞り込み＋都道府県自動取得＋PDF */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelected([])}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            selected.length === 0
              ? "border-[#1b4da0] bg-[#1b4da0] text-white"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          全て
        </button>
        {stageOptions.map((t) => {
          const on = selected.includes(t)
          return (
            <button
              key={t}
              onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                on
                  ? "border-[#1b4da0] bg-[#1b4da0] text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2">
          {missingPref.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={autoFillPref}
              disabled={busy}
              className="border-[#1b4da0] text-[#1b4da0] hover:bg-blue-50"
              title="都道府県が空の案件を、候補地の座標から自動取得します"
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPin className="mr-1.5 h-4 w-4" />}
              都道府県を自動取得（{missingPref.length}）
            </Button>
          )}
          <Button size="sm" onClick={downloadPdf} className="bg-[#1b4da0] hover:bg-[#163f85]">
            <Download className="mr-1.5 h-4 w-4" />
            PDFでダウンロード
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#1b2b4b] text-xs text-white">
              <th className="px-4 py-3 font-semibold">ブランド</th>
              <th className="px-4 py-3 font-semibold">都道府県</th>
              <th className="px-4 py-3 font-semibold">プロジェクト名</th>
              <th className="px-4 py-3 text-center font-semibold">着工</th>
              <th className="px-4 py-3 text-center font-semibold">設営</th>
              <th className="px-4 py-3 text-center font-semibold">OPEN</th>
              <th className="px-4 py-3 text-center font-semibold">初回入金</th>
              <th className="px-4 py-3 text-center font-semibold">二回目入金</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const brand = brandOf(c)
              const special = brand !== "スプラッシュンゴー" // SPB九州・D-wash等は枠付きで強調
              const pref = prefOf(c)
              const fuzzy = isFuzzy(c)
              return (
                <tr key={c.id} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                  <td className="whitespace-nowrap border-t border-gray-100 px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-1 text-[11px] font-bold ${
                        special ? "border border-[#1b4da0] text-[#1b4da0]" : "text-gray-600"
                      }`}
                    >
                      {brand}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-t border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
                    {pref || "—"}
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                    {c.store_name || c.title}
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-center">
                    <DateCell s={c.start_date} fuzzy={fuzzy} />
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-center">
                    <DateCell s={c.setup_date} fuzzy={fuzzy} />
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-center">
                    <DateCell s={c.open_date} fuzzy={fuzzy} />
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-center">
                    <PayCell s={c.payment1_date} amt={c.payment1_amount} fuzzy={fuzzy} />
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-center">
                    <PayCell s={c.payment2_date} amt={c.payment2_amount} fuzzy={fuzzy} />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  日付が入力された案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
