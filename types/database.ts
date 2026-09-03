// 出店プロジェクトのカテゴリ（ブランド）
export type ProjectCategory = "スプラッシュンゴー" | "D-Splash" | "丸紅-Splash"

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  "スプラッシュンゴー",
  "D-Splash",
  "丸紅-Splash",
]

// 段階（ヨミ）＝ボードの列。6段階。並び順もこの順。（設営中・Dヨミは廃止）
export const STAGES = ["OPEN", "工事中", "契約済", "Aヨミ", "Bヨミ", "Cヨミ"] as const
export type Stage = (typeof STAGES)[number]

// 段階ごとの色・ピン表示ラベル（地図ピン・フィルタ・タイムライン共通）
export const STAGE_COLORS: Record<string, string> = {
  OPEN: "#16a34a", // 緑（ピンはロゴのみ）
  工事中: "#dc2626", // 赤
  契約済: "#7c3aed", // 紫
  Aヨミ: "#2563eb", // 青
  Bヨミ: "#38bdf8", // 水色
  Cヨミ: "#eab308", // 黄
}
// ピンに出す短い表記（OPENはロゴのみなので空）
export const STAGE_PIN_LABEL: Record<string, string> = {
  OPEN: "",
  工事中: "工事",
  契約済: "契",
  Aヨミ: "A",
  Bヨミ: "B",
  Cヨミ: "C",
}

// リスト名/旧ラベルを6段階のいずれかに正規化（完了→OPEN、設営中→工事中、未確定/Dヨミ→Cヨミ）
export function normalizeStage(title?: string | null): Stage {
  const t = title ?? ""
  if (t.includes("OPEN") || t.includes("完了") || t.includes("オープン")) return "OPEN"
  if (t.includes("工事") || t.includes("設営")) return "工事中"
  if (t.includes("契約")) return "契約済"
  if (t.includes("Aヨミ")) return "Aヨミ"
  if (t.includes("Bヨミ")) return "Bヨミ"
  if (t.includes("Cヨミ") || t.includes("Dヨミ") || t.includes("未確定")) return "Cヨミ"
  return "Cヨミ"
}

// 都道府県 → エリア（地方区分）
export const REGIONS = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州", "その他"] as const
const PREF_CORE_REGION: Record<string, string> = {
  青森: "東北", 岩手: "東北", 宮城: "東北", 秋田: "東北", 山形: "東北", 福島: "東北",
  茨城: "関東", 栃木: "関東", 群馬: "関東", 埼玉: "関東", 千葉: "関東", 東京: "関東", 神奈川: "関東",
  新潟: "中部", 富山: "中部", 石川: "中部", 福井: "中部", 山梨: "中部", 長野: "中部", 岐阜: "中部", 静岡: "中部", 愛知: "中部",
  三重: "近畿", 滋賀: "近畿", 京都: "近畿", 大阪: "近畿", 兵庫: "近畿", 奈良: "近畿", 和歌山: "近畿",
  鳥取: "中国", 島根: "中国", 岡山: "中国", 広島: "中国", 山口: "中国",
  徳島: "四国", 香川: "四国", 愛媛: "四国", 高知: "四国",
  福岡: "九州", 佐賀: "九州", 長崎: "九州", 熊本: "九州", 大分: "九州", 宮崎: "九州", 鹿児島: "九州", 沖縄: "九州",
}
export function regionOf(pref?: string | null): string {
  if (!pref) return "その他"
  const p = pref.trim()
  if (p.includes("北海道")) return "北海道"
  const core = p.replace(/[都道府県]$/, "")
  return PREF_CORE_REGION[core] ?? "その他"
}

// 市区町村コード（JIS・先頭2桁=都道府県コード）→ エリア（地方）。
// 座標→逆ジオコーダの muniCd から地方を判定するのに使う。
// 市区町村コード（JIS・先頭2桁）→ 都道府県名（コア名）。エリア=都道府県単位のグルーピング用。
const PREF_CODE_NAME: Record<number, string> = {
  1: "北海道", 2: "青森", 3: "岩手", 4: "宮城", 5: "秋田", 6: "山形", 7: "福島",
  8: "茨城", 9: "栃木", 10: "群馬", 11: "埼玉", 12: "千葉", 13: "東京", 14: "神奈川",
  15: "新潟", 16: "富山", 17: "石川", 18: "福井", 19: "山梨", 20: "長野", 21: "岐阜", 22: "静岡", 23: "愛知",
  24: "三重", 25: "滋賀", 26: "京都", 27: "大阪", 28: "兵庫", 29: "奈良", 30: "和歌山",
  31: "鳥取", 32: "島根", 33: "岡山", 34: "広島", 35: "山口",
  36: "徳島", 37: "香川", 38: "愛媛", 39: "高知",
  40: "福岡", 41: "佐賀", 42: "長崎", 43: "熊本", 44: "大分", 45: "宮崎", 46: "鹿児島", 47: "沖縄",
}
export function prefFromMuniCd(muniCd?: string | null): string | null {
  if (!muniCd) return null
  const c = Number(String(muniCd).padStart(5, "0").slice(0, 2))
  return PREF_CODE_NAME[c] ?? null
}
// 住所文字列の先頭から都道府県コア名を抽出（例:「群馬県太田市…」→「群馬」）
export function prefFromAddress(addr?: string | null): string | null {
  if (!addr) return null
  const m = addr.trim().match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/)
  if (!m) return null
  return m[1].replace(/[都道府県]$/, "")
}

export function regionFromMuniCd(muniCd?: string | null): string {
  if (!muniCd) return "その他"
  const c = Number(String(muniCd).padStart(5, "0").slice(0, 2))
  if (!Number.isFinite(c) || c <= 0) return "その他"
  if (c === 1) return "北海道"
  if (c >= 2 && c <= 7) return "東北"
  if (c >= 8 && c <= 14) return "関東"
  if (c >= 15 && c <= 23) return "中部"
  if (c >= 24 && c <= 30) return "近畿"
  if (c >= 31 && c <= 35) return "中国"
  if (c >= 36 && c <= 39) return "四国"
  if (c >= 40 && c <= 47) return "九州"
  return "その他"
}

// カテゴリごとのピン/バッジ色（Google Maps・UI共通）
export const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  スプラッシュンゴー: "#2563eb", // blue
  "D-Splash": "#0891b2", // cyan
  "丸紅-Splash": "#d97706", // amber
}

// 旧カテゴリや空値を新3カテゴリに正規化（既存データ対策）
export function normalizeCategory(value?: string | null): ProjectCategory {
  if (value === "D-Splash" || value === "丸紅-Splash" || value === "スプラッシュンゴー") {
    return value
  }
  // 旧「自社店舗」その他はスプラッシュンゴー扱い
  return "スプラッシュンゴー"
}

// 自社店舗マスター（stores テーブル）
export interface Store {
  id: string
  store_code: string | null
  store_name: string
  brand: string | null
  category: string | null
  phone: string | null
  zip_code: string | null
  address: string | null
  mail: string | null
  latitude: number | null
  longitude: number | null
  district?: string | null
  property_no?: string | null
  location_type?: string | null
  prefecture?: string | null
  open_date?: string | null
  rank?: string | null
  status?: string | null
  traffic_12h?: number | null
  surrounding_score?: number | null
  passing_speed?: number | null
  corner_lot?: boolean | null
  visibility?: boolean | null
  awareness?: number | null
  household_income?: number | null
  size_tsubo?: number | null
  car_capacity?: number | null
  wipe_spaces?: number | null
  pop_1km?: number | null
  pop_2km?: number | null
  pop_5km?: number | null
  created_at?: string
  updated_at?: string
}

// 地図上の共通アイテム（自社店舗 or プロジェクト）
export interface MapItem {
  id: string
  kind: "store" | "project"
  name: string
  category: ProjectCategory
  stage?: string | null // ヨミ（Aヨミ/Bヨミ/完了/未確定 等）。storeはOPEN扱い
  lat: number
  lng: number
  address?: string | null
  brand?: string | null
  store_code?: string | null
  phone?: string | null
  location_type?: string | null
  prefecture?: string | null
  open_date?: string | null
  rank?: string | null
  status?: string | null
  traffic_12h?: number | null
  surrounding_score?: number | null
  passing_speed?: number | null
  corner_lot?: boolean | null
  visibility?: boolean | null
  awareness?: number | null
  household_income?: number | null
  size_tsubo?: number | null
  car_capacity?: number | null
  wipe_spaces?: number | null
  pop_1km?: number | null
  pop_2km?: number | null
  pop_5km?: number | null
}

// データベースの型定義
export interface Card {
  id: string
  list_id: string
  title: string
  status: string
  memo: string
  open_date: string | null
  start_date: string | null
  candidate_url: string
  candidate_url2: string
  company_name: string
  company_url: string
  position: number
  created_at: string
  updated_at: string
  trello_list_id?: string | null
  trello_card_id?: string | null
  spec_sheet_url?: string | null // 候補地スペック取込用スプレッドシートURL
  drawings?: { name: string; url: string }[] | null // 図面ファイル（Supabase Storage）

  // --- ArmBox 出店プロジェクト項目（04-armbox-fields.sql で追加） ---
  category?: ProjectCategory | null // カテゴリ
  district?: string | null // 地区
  property_no?: string | null // 物件番号
  brand?: string | null // ブランド名
  store_name?: string | null // 店舗名
  location_type?: string | null // 立地タイプ
  prefecture?: string | null // 都道府県
  address?: string | null // 住所
  rank?: string | null // ランク
  traffic_12h?: number | null // 日中12時間交通量
  surrounding_score?: number | null // 周辺充実度
  passing_speed?: number | null // 通過速度
  corner_lot?: boolean | null // 角地
  visibility?: boolean | null // 視認性
  awareness?: number | null // 認知度
  household_income?: number | null // 世帯年収（万円）
  size_tsubo?: number | null // 広さ（坪）
  car_capacity?: number | null // 何台並べるか
  wipe_spaces?: number | null // 拭上げスペース数
  pop_1km?: number | null // 同心円1.0km人口総数
  pop_2km?: number | null // 同心円2.0km人口総数
  pop_5km?: number | null // 同心円5.0km人口総数
  lat?: number | null // 緯度
  lng?: number | null // 経度
}

export interface List {
  id: string
  board_id: string
  title: string
  position: number
  created_at: string
  updated_at: string
}

export interface Board {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface BoardData {
  id: string
  title: string
  lists: (List & { cards: Card[] })[]
}

export interface Attachment {
  id: string
  card_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_at: string
  created_at: string
}

export interface TrelloList {
  id: string
  name: string
  cards: TrelloCard[]
}

export interface TrelloCard {
  id: string
  name: string
  desc: string
}

export interface TrelloAttachment {
  id: string
  name: string
  url: string
  bytes: number
  date: string
}
