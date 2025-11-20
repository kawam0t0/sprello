import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// 型定義を簡素化
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
