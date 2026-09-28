-- ============================================================
-- PJT進捗 × Googleカレンダー連携用の列を追加。
-- 各todoが連携したカレンダー予定のIDと、置いたカレンダー(担当者メール)を覚えておく。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等。
-- ============================================================
alter table project_todos add column if not exists gcal_event_id text;
alter table project_todos add column if not exists gcal_calendar_id text;
