-- ブランド名の更新
--   D-Splash → D-wash×SPB
--   丸紅-Splash → 廃止（スプラッシュンゴーへ寄せる）
-- Supabase の SQL Editor で実行してください。
update cards  set category = 'D-wash×SPB'      where category = 'D-Splash';
update cards  set category = 'スプラッシュンゴー' where category = '丸紅-Splash';
update cards  set brand    = 'D-wash×SPB'      where brand    = 'D-Splash';
update cards  set brand    = 'スプラッシュンゴー' where brand    = '丸紅-Splash';
update stores set category = 'D-wash×SPB'      where category = 'D-Splash';
update stores set category = 'スプラッシュンゴー' where category = '丸紅-Splash';
update stores set brand    = 'D-wash×SPB'      where brand    = 'D-Splash';
update stores set brand    = 'スプラッシュンゴー' where brand    = '丸紅-Splash';
