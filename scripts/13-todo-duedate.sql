-- ============================================================
-- PJT進捗のTODOに「期日」列を追加。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等。
-- ============================================================
alter table project_todos add column if not exists due_date date;
