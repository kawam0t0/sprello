-- ============================================================
-- Sprello 追加更新 (11) — PJT進捗（契約済以降のTODO管理）
-- Supabase の SQL Editor で上から順に実行してください。冪等（複数回実行可）。
-- ============================================================

-- プロジェクトごとのTODO（大項目/中項目/小項目の3階層）
--   level: 1=大項目, 2=中項目, 3=小項目
--   parent_id: 親TODO。大項目は null。親を消すと子も消える(ON DELETE CASCADE)
--   card_id を消すとそのプロジェクトのTODOは全て消える
create table if not exists project_todos (
  id         uuid default gen_random_uuid() primary key,
  card_id    uuid references cards(id) on delete cascade,
  parent_id  uuid references project_todos(id) on delete cascade,
  level      smallint not null default 1,
  title      text not null default '',
  checked    boolean not null default false,
  assignee   text,
  memo       text not null default '',
  position   integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_project_todos_card   on project_todos(card_id);
create index if not exists idx_project_todos_parent on project_todos(parent_id);
create index if not exists idx_project_todos_pos     on project_todos(card_id, position);

-- リアルタイム購読に追加（既に追加済みなら何もしない＝冪等）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_todos'
  ) then
    alter publication supabase_realtime add table project_todos;
  end if;
end $$;
