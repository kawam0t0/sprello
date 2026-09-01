-- 段階（ヨミ）＝ボードの列を8段階に整える
-- OPEN / 工事中 / 設営中 / 契約済 / Aヨミ / Bヨミ / Cヨミ / Dヨミ
-- 対象ボード: 550e8400-e29b-41d4-a716-446655440000
-- 既存の 完了→OPEN、未確定→Dヨミ にリネームし、不足列を追加、並び順を統一する。
-- 何度実行しても同じ結果（冪等）。Supabase の SQL Editor で実行してください。

-- 1) 既存列のリネーム
update lists set title = 'OPEN'
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = '完了';
update lists set title = 'Dヨミ'
  where board_id = '550e8400-e29b-41d4-a716-446655440000' and title = '未確定';

-- 2) 不足している列を追加（工事中・設営中・契約済）
insert into lists (board_id, title, position)
select '550e8400-e29b-41d4-a716-446655440000', t.title, t.pos
from (values ('工事中', 1), ('設営中', 2), ('契約済', 3)) as t(title, pos)
where not exists (
  select 1 from lists l
  where l.board_id = '550e8400-e29b-41d4-a716-446655440000' and l.title = t.title
);

-- 3) 並び順を8段階に統一
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
