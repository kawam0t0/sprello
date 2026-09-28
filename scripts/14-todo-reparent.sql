-- ============================================================
-- PJT進捗：大項目リネーム＋中項目の親付け替え（既存データは保持＝非破壊）
--
--   A) 大項目「OPEN日を決める」→「契約済になれば即実施/確認すること」にリネーム
--   B) 「システムを整える」配下の中項目
--        ・光回線の契約 / GoogleMap / Squareアカウント / DialPad
--      を、A でリネームした大項目の配下へ移動
--
--   既存のチェック・メモ・期日(due_date)・小項目はそのまま引き継がれる
--   （行のtitle/parent_idだけを書き換えるため、値は一切消えない）。
--
-- 【重要】このSQLは新しいコードをデプロイする「前」に実行すること。
--   先にコードをデプロイすると、テンプレ差分の自動追加(additive sync)が
--   リネーム後の大項目を「別物」とみなして重複作成する恐れがあるため。
--
--   Supabase の SQL Editor で実行 →「Run without RLS」でOK。
--   何度実行しても結果は同じ（冪等）。
-- ============================================================

-- A) 大項目のリネーム（level=1／トップ階層のみ）
update project_todos
set title = '契約済になれば即実施/確認すること',
    updated_at = now()
where title = 'OPEN日を決める'
  and parent_id is null
  and level = 1;

-- B) 4つの中項目を「システムを整える」から「契約済になれば即実施/確認すること」へ移動
--    プロジェクト(card)ごとに、それぞれの大項目IDを突き合わせて付け替える。
with sys as (
  -- 各カードの「システムを整える」大項目
  select id as sys_id, card_id
  from project_todos
  where parent_id is null and level = 1 and title = 'システムを整える'
),
tgt as (
  -- 各カードの移動先大項目（A でリネーム済み）
  select id as tgt_id, card_id
  from project_todos
  where parent_id is null and level = 1 and title = '契約済になれば即実施/確認すること'
),
moving as (
  -- 移動対象：システムを整える直下(level=2)の対象4項目
  select t.id,
         t.card_id,
         row_number() over (partition by t.card_id order by t.position) as rn
  from project_todos t
  join sys on sys.sys_id = t.parent_id and sys.card_id = t.card_id
  where t.level = 2
    and t.title in ('光回線の契約', 'GoogleMap', 'Squareアカウント', 'DialPad')
),
maxpos as (
  -- 移動先の既存子の最大position（末尾に追記するため）
  select tgt.card_id, coalesce(max(c.position), -1) as maxp
  from tgt
  left join project_todos c
    on c.parent_id = tgt.tgt_id and c.card_id = tgt.card_id
  group by tgt.card_id
)
update project_todos p
set parent_id = tgt.tgt_id,
    position  = maxpos.maxp + moving.rn,
    updated_at = now()
from moving
join tgt    on tgt.card_id    = moving.card_id
join maxpos on maxpos.card_id = moving.card_id
where p.id = moving.id;
