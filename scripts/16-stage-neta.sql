-- 段階（ヨミ）＝ボードの列に「ネタ」を追加（Cヨミの次）
-- 対象ボード: 550e8400-e29b-41d4-a716-446655440000
-- Supabase の SQL Editor で実行 →「Run without RLS」でOK。冪等（何度実行しても同じ）。

insert into lists (board_id, title, position)
select '550e8400-e29b-41d4-a716-446655440000', 'ネタ', 8
where not exists (
  select 1 from lists
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = 'ネタ'
);

-- 並び順を統一（ネタはCヨミの次＝末尾側）
update lists set position = case title
  when 'OPEN'   then 0
  when '工事中' then 1
  when '設営中' then 2
  when '契約済' then 3
  when 'Aヨミ'  then 4
  when 'Bヨミ'  then 5
  when 'Cヨミ'  then 6
  when 'Dヨミ'  then 7
  when 'ネタ'   then 8
  else position
end
where board_id = '550e8400-e29b-41d4-a716-446655440000';
