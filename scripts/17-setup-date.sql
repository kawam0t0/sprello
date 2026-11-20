-- タスク（カード）に「設営日」列を追加。
-- OPEN日・着工日に加えて設営日も記録できるようにする。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等。
alter table cards add column if not exists setup_date date;
