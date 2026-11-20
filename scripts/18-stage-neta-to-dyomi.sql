-- 「ネタ」段階を「Dヨミ」に統一する（ネタは廃止、Dヨミを正式な最下段ヨミにする）
-- 対象ボード: 550e8400-e29b-41d4-a716-446655440000
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等（何度実行しても同じ）。
-- ※ scripts/16-stage-neta.sql は本ファイルで置き換え。16は実行不要。

-- 1) Dヨミ列が無ければ作成（Cヨミの次）
insert into lists (board_id, title, position)
select '550e8400-e29b-41d4-a716-446655440000', 'Dヨミ', 7
where not exists (
  select 1 from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'Dヨミ'
);

-- 2) 「ネタ」列にカードがあればDヨミへ移動（16を実行済みの場合の保険）
update cards set list_id = (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'Dヨミ' limit 1
)
where list_id in (
  select id from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'ネタ'
);

-- 3) 「ネタ」列を削除（カードは上で移動済み）
delete from lists
where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'ネタ';

-- 4) 並び順を統一（Dヨミ＝Cヨミの次）
update lists set position = case title
  when 'OPEN'   then 0
  when '工事中' then 1
  when '設営中' then 2
  when '契約済' then 3
  when 'Aヨミ'  then 4
  when 'Bヨミ'  then 5
  when 'Cヨミ'  then 6
  when 'Dヨミ'  then 7
  else position
end
where board_id = '550e8400-e29b-41d4-a716-446655440000';
