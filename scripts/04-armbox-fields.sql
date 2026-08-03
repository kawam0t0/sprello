-- =============================================================
-- ArmBox化マイグレーション : cards テーブルに出店プロジェクト項目を追加
-- 既存データ・タイムライン・リアルタイム同期を壊さない「追加のみ」の変更です。
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。
-- =============================================================

-- カテゴリ（自社店舗 / 物件 / 出店ターゲット / 閉店店舗 / 競合）
ALTER TABLE cards ADD COLUMN IF NOT EXISTS category         TEXT    DEFAULT '自社店舗';

-- 基本情報
ALTER TABLE cards ADD COLUMN IF NOT EXISTS district         TEXT    DEFAULT '';   -- 地区
ALTER TABLE cards ADD COLUMN IF NOT EXISTS property_no      TEXT    DEFAULT '';   -- 物件番号
ALTER TABLE cards ADD COLUMN IF NOT EXISTS brand            TEXT    DEFAULT '';   -- ブランド名
ALTER TABLE cards ADD COLUMN IF NOT EXISTS store_name       TEXT    DEFAULT '';   -- 店舗名
ALTER TABLE cards ADD COLUMN IF NOT EXISTS location_type    TEXT    DEFAULT '';   -- 立地タイプ
ALTER TABLE cards ADD COLUMN IF NOT EXISTS prefecture       TEXT    DEFAULT '';   -- 都道府県
ALTER TABLE cards ADD COLUMN IF NOT EXISTS address          TEXT    DEFAULT '';   -- 住所

-- 評価・分析指標
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rank             TEXT    DEFAULT '';   -- ランク（S/A/A-/B ...）
ALTER TABLE cards ADD COLUMN IF NOT EXISTS traffic_12h      INTEGER;             -- 日中12時間交通量
ALTER TABLE cards ADD COLUMN IF NOT EXISTS surrounding_score INTEGER;            -- 周辺充実度
ALTER TABLE cards ADD COLUMN IF NOT EXISTS passing_speed    INTEGER;             -- 通過速度
ALTER TABLE cards ADD COLUMN IF NOT EXISTS corner_lot       BOOLEAN DEFAULT FALSE; -- 角地
ALTER TABLE cards ADD COLUMN IF NOT EXISTS visibility       BOOLEAN DEFAULT FALSE; -- 視認性
ALTER TABLE cards ADD COLUMN IF NOT EXISTS awareness        INTEGER;             -- 認知度
ALTER TABLE cards ADD COLUMN IF NOT EXISTS household_income INTEGER;             -- 世帯年収（万円）

-- 物件スペック
ALTER TABLE cards ADD COLUMN IF NOT EXISTS size_tsubo       NUMERIC;             -- 広さ（坪）
ALTER TABLE cards ADD COLUMN IF NOT EXISTS car_capacity     INTEGER;             -- 何台並べるか
ALTER TABLE cards ADD COLUMN IF NOT EXISTS wipe_spaces      INTEGER;             -- 拭上げスペース数

-- 商圏人口（同心円・住基）
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pop_1km          INTEGER;             -- 同心円1.0km人口総数
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pop_2km          INTEGER;             -- 同心円2.0km人口総数
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pop_5km          INTEGER;             -- 同心円5.0km人口総数

-- 地図表示用の緯度経度（住所からGeocodingで自動補完）
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lat              DOUBLE PRECISION;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lng              DOUBLE PRECISION;

-- 地図の絞り込み用インデックス
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_latlng   ON cards(lat, lng);
