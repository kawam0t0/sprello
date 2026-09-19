import { NextRequest, NextResponse } from "next/server"

// リアル販促物などの「備品リスト」スプレッドシートを gviz(公開CSV) で読み、
// A〜D のカテゴリ・品目・指定/推奨・リンク・数量にパースして返す。
// 共有が「リンクを知る全員が閲覧可」であれば認証不要で読める。

function extractId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}
function extractGid(url: string): string | null {
  const m = url.match(/[#&?]gid=([0-9]+)/)
  return m ? m[1] : null
}

// カンマ/改行/引用に対応した簡易CSVパーサ（Amazon等のURLはカンマを含むため必須）
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

type Item = { key: string; kind: string; name: string; url: string | null; note: string | null; qty: string }
type Category = { key: string; title: string; items: Item[] }

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url") ?? ""
  const id = extractId(url)
  if (!id) {
    return NextResponse.json({ error: "スプレッドシートのURLが不正です" }, { status: 400 })
  }
  const gid = extractGid(url)

  // gid指定があればそのタブ、無ければ先頭タブ
  const gviz =
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=0` +
    (gid ? `&gid=${gid}` : "")

  let text: string
  try {
    const res = await fetch(gviz, { headers: { Accept: "text/csv" } })
    text = await res.text()
    if (!res.ok || text.trimStart().startsWith("<")) {
      return NextResponse.json({
        found: false,
        message:
          "シートを読めませんでした。共有設定を『リンクを知る全員が閲覧可』にしてください。",
      })
    }
  } catch (e) {
    console.error("[supplies] fetch error:", e)
    return NextResponse.json({ found: false, message: "スプレッドシートの取得に失敗しました" })
  }

  const rows = parseCsv(text)
  const categories: Category[] = []
  let current: Category | null = null

  for (const r of rows) {
    const c0 = (r[0] ?? "").trim()
    // カテゴリ見出し行：先頭セルが「A.」〜「Z.」で始まる
    const head = c0.match(/^([A-Za-z])[.．](.*)$/)
    if (head) {
      current = { key: head[1].toUpperCase(), title: c0, items: [] }
      categories.push(current)
      continue
    }
    // 品目行：先頭セルが空で、2列目が 指定/推奨
    const kind = (r[1] ?? "").trim()
    const name = (r[2] ?? "").trim()
    if (!current) continue
    if ((kind === "指定" || kind === "推奨") && name) {
      const link = (r[3] ?? "").trim()
      // 数量は末尾の非空セル
      let qty = ""
      for (let j = r.length - 1; j >= 3; j--) {
        const v = (r[j] ?? "").trim()
        if (v && v !== link) {
          qty = v
          break
        }
      }
      // linkが数量と同一（=参考列が空）だった場合の補正
      if (qty === "" && link && !isUrl(link)) qty = ""
      current.items.push({
        key: `${current.key}::${name}`,
        kind,
        name,
        url: isUrl(link) ? link : null,
        note: !isUrl(link) && link ? link : null,
        qty,
      })
    }
  }

  const total = categories.reduce((n, c) => n + c.items.length, 0)
  if (total === 0) {
    return NextResponse.json({
      found: false,
      message:
        "シートは読めましたが、備品リスト（A〜Dのカテゴリと『指定/推奨・品目・数量』の行）が見つかりませんでした。タブ(gid)や書式をご確認ください。",
    })
  }

  return NextResponse.json({ found: true, categories, total })
}
