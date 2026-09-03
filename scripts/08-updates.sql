-- ============================================================
-- Sprello 追加更新 (08)
-- Supabase の SQL Editor で上から順に実行してください。冪等（複数回実行可）。
-- 対象ボード: 550e8400-e29b-41d4-a716-446655440000
-- ============================================================

-- 1) 店名の「SPLASH'N'GO!」→「スプラッシュンゴー」置換（後続スペースも詰める）
update stores set store_name =
  replace(
    replace(
      replace(store_name, 'SPLASH''N''GO!', 'スプラッシュンゴー'),
      'SPLASH''N''GO', 'スプラッシュンゴー'),
    'スプラッシュンゴー ', 'スプラッシュンゴー')
where store_name like '%SPLASH%';

update cards set store_name =
  replace(
    replace(
      replace(store_name, 'SPLASH''N''GO!', 'スプラッシュンゴー'),
      'SPLASH''N''GO', 'スプラッシュンゴー'),
    'スプラッシュンゴー ', 'スプラッシュンゴー')
where store_name like '%SPLASH%';

update cards set title =
  replace(
    replace(
      replace(title, 'SPLASH''N''GO!', 'スプラッシュンゴー'),
      'SPLASH''N''GO', 'スプラッシュンゴー'),
    'スプラッシュンゴー ', 'スプラッシュンゴー')
where title like '%SPLASH%';

-- 2) 段階から「設営中」「Dヨミ」を廃止（中のカードを移動してから列を削除）
--    設営中 → 工事中、Dヨミ → Cヨミ
update cards set list_id = (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = '工事中' limit 1)
where list_id in (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = '設営中');

update cards set list_id = (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'Cヨミ' limit 1)
where list_id in (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'Dヨミ');

delete from lists
where board_id = '550e8400-e29b-41d4-a716-446655440000' and title in ('設営中', 'Dヨミ');

-- 3) 不要になった項目の格納データを削除（列は残すが値をクリア）
--    ランク / 何台並べるか / 拭上げスペース数 / 認知度 / 角地 / 視認性
update cards set rank = null, car_capacity = null, wipe_spaces = null,
  awareness = null, corner_lot = null, visibility = null;
update stores set rank = null, car_capacity = null, wipe_spaces = null,
  awareness = null, corner_lot = null, visibility = null;

-- 4) 図面添付用のカラムを追加（jsonb: [{name,url}, ...]）
alter table cards add column if not exists drawings jsonb;

-- 5) 図面ファイル用の Storage バケット「drawings」を作成（公開）＋ポリシー
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', true)
on conflict (id) do update set public = true;

drop policy if exists "drawings public read" on storage.objects;
create policy "drawings public read" on storage.objects
  for select using (bucket_id = 'drawings');

drop policy if exists "drawings anon insert" on storage.objects;
create policy "drawings anon insert" on storage.objects
  for insert with check (bucket_id = 'drawings');
