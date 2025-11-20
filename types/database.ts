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
