import { NextRequest, NextResponse } from "next/server"

// Googleスプレッドシート「本部使用【候補地スペック】」シートから候補地スペックを取得する。
// 共有設定が「リンクを知る全員が閲覧可」であれば、APIキー・認証なしで
// gviz(公開CSV書き出し)エンドポイントから読める。
// シートは縦のキー＝値レイアウト（C列＝項目名 / D列＝値 / E列＝単位）。

const DEFAULT_SHEET = "本部使用【候補地スペック】"

// スプレッドシートURLからID部分を抽出
function extractId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

// 簡易CSVパーサ（"1,500" のようなカンマ入り引用フィールドに対応）
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQ = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQ = false
        i++
        continue
      }
      field += ch
      i++
      continue
    } else {
      if (ch === '"') {
        inQ = true
        i++
        continue
      }
      if (ch === ",") {
        row.push(field)
        field = ""
        i++
        continue
      }
      if (ch === "\r") {
        i++
        continue
      }
      if (ch === "\n") {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
        i++
        continue
      }
      field += ch
      i++
      continue
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const norm = (s: unknown): string => String(s ?? "").replace(/[\s　]/g, "").trim()

// 数値化（全角→半角、カンマ・単位記号を除去）
function toNum(s: unknown): number | null {
  if (s == null) return null
  let t = String(s).trim()
  if (!t) return null
  t = t.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
  t = t.replace(/[,，¥￥%％円\s　台人坪]/g, "")
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// 項目名に一致するセルを探し、その「右隣のセル(D列)」の生値を返す
function rightOf(rows: string[][], pred: (label: string) => boolean): string | null {
  for (const r of rows) {
    for (let j = 0; j < r.length; j++) {
      if (pred(norm(r[j]))) {
        return r[j + 1] ?? null
      }
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url") ?? ""
  const sheet = searchParams.get("sheet") || DEFAULT_SHEET

  const id = extractId(url)
  if (!id) {
    return NextResponse.json(
      { error: "スプレッドシートのURLが不正です（/spreadsheets/d/... 形式で貼ってください）" },
      { status: 400 },
    )
  }

  const gviz = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(
    sheet,
  )}`

  let text: string
  try {
    const res = await fetch(gviz, { headers: { Accept: "text/csv" } })
    text = await res.text()
    // 共有OFFやシート名違いのときはHTML(ログイン/エラー)が返る
    if (!res.ok || text.trimStart().startsWith("<")) {
      return NextResponse.json({
        found: false,
        message:
          "シートを読めませんでした。共有が『リンクを知る全員が閲覧可』か、シート名『" +
          sheet +
          "』が正しいかご確認ください。",
      })
    }
  } catch (e) {
    console.error("[sheet-spec] fetch error:", e)
    return NextResponse.json({ found: false, message: "スプレッドシートの取得に失敗しました" })
  }

  const rows = parseCsv(text)

  const storeRaw = rightOf(rows, (c) => c === "店舗名")
  const values: Record<string, number | string | null> = {
    store_name: storeRaw != null && storeRaw.trim() !== "" ? storeRaw.trim() : null,
    size_tsubo: toNum(rightOf(rows, (c) => c === "坪数")),
    // 「交通量」「日中12時間交通量」どちらの表記でも拾う
    traffic_12h: toNum(rightOf(rows, (c) => c.endsWith("交通量") && c !== "")),
    // 「世帯年収」「世帯年収_万円」等
    household_income: toNum(rightOf(rows, (c) => c.startsWith("世帯年収"))),
    passing_speed: toNum(rightOf(rows, (c) => c === "通過速度")),
    // シート側「消費施設充実度」＝アプリ側「周辺充実度」
    surrounding_score: toNum(rightOf(rows, (c) => c === "消費施設充実度" || c === "周辺充実度")),
  }

  const filled = Object.entries(values)
    .filter(([, v]) => v != null && v !== "")
    .map(([k]) => k)

  if (filled.length === 0) {
    return NextResponse.json({
      found: false,
      message:
        "シートは読めましたが、対象項目(店舗名/坪数/交通量/世帯年収/通過速度/消費施設充実度)が見つかりませんでした。",
    })
  }

  return NextResponse.json({ found: true, sheet, values, filled })
}
