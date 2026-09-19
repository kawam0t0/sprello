-- ============================================================
-- 備品リスト（リアル販促物）をアプリ内で管理するためのテーブル。
-- 品目はプロジェクト（店舗）ごとに保持し、追加/削除/チェックできる。
-- 初回に開いたときテンプレートから自動生成される（既存は非破壊）。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等。
-- ============================================================
create table if not exists project_supply_items (
  id         uuid default gen_random_uuid() primary key,
  card_id    uuid references cards(id) on delete cascade,
  category   text not null default '',    -- A / B / C / D など
  cat_title  text not null default '',    -- 例: A.入り口受付用品
  kind       text not null default '推奨', -- 指定 / 推奨
  name       text not null default '',
  url        text,
  note       text,
  qty        text,
  checked    boolean not null default false,
  position   integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists idx_project_supply_items_card on project_supply_items(card_id);

-- 備品リストはアプリ内に持つようになったため、TODOの「リアル販促物」メモに貼っていた
-- スプレッドシートURLは不要。既存データのメモをクリアする。
update project_todos set memo = '' where title = 'リアル販促物';
