-- ============================================================
-- 備品リスト（リアル販促物など）の購入チェックを店舗ごとに保存する表
-- item_key はカテゴリ+品目名（例: "A::インカム2個入り"）。
-- 品目マスターはスプレッドシート側が正（アプリはシートを読み込んで表示）。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等。
-- ============================================================
create table if not exists project_supplies (
  id         uuid default gen_random_uuid() primary key,
  card_id    uuid references cards(id) on delete cascade,
  item_key   text not null,
  checked    boolean not null default false,
  updated_at timestamp with time zone default now(),
  unique (card_id, item_key)
);

create index if not exists idx_project_supplies_card on project_supplies(card_id);
