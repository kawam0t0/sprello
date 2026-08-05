// 出店プロジェクトのカテゴリ（ブランド）
export type ProjectCategory = "スプラッシュンゴー" | "D-Splash" | "丸紅-Splash"

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  "スプラッシュンゴー",
  "D-Splash",
  "丸紅-Splash",
]

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
