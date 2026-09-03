-- 店舗一覧(stores)に 候補地URL(GoogleマップURL) を追加。
-- OPEN店舗のピンを住所ではなくGoogleマップURLの正確な座標で立て直すために使う。
-- Supabase の SQL Editor で実行してください。
alter table stores add column if not exists candidate_url text;
