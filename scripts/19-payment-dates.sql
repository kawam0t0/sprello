-- 入金予定（初回・二回目）の日付と金額(円)をcardsに追加。
-- タイムラインの着金表示は、自動計算からこの保存値（初回・二回目）ベースに変更。
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等（何度実行しても同じ）。

alter table cards add column if not exists payment1_date date;
alter table cards add column if not exists payment1_amount bigint;
alter table cards add column if not exists payment2_date date;
alter table cards add column if not exists payment2_amount bigint;

-- 既存の空欄を、現行タイムラインの着金1・着金2の自動計算日で初期化
--   着金1 = 着工日(start_date) - 10日 → 初回入金予定日
--   着金2 = OPEN日(open_date) - 2ヶ月 → 二回目入金予定日
update cards set payment1_date = (start_date - interval '10 days')::date
  where payment1_date is null and start_date is not null;
update cards set payment2_date = (open_date - interval '2 months')::date
  where payment2_date is null and open_date is not null;
