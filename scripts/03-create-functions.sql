-- カード位置交換用のRPC関数
CREATE OR REPLACE FUNCTION swap_card_positions(card1_id UUID, card2_id UUID)
RETURNS VOID AS $$
DECLARE
  card1_position INTEGER;
  card2_position INTEGER;
  card1_list_id UUID;
  card2_list_id UUID;
BEGIN
  -- カード1の情報を取得
  SELECT position, list_id INTO card1_position, card1_list_id
  FROM cards WHERE id = card1_id;
  
  -- カード2の情報を取得
  SELECT position, list_id INTO card2_position, card2_list_id
  FROM cards WHERE id = card2_id;
  
  -- 位置を交換
  UPDATE cards SET position = card2_position, updated_at = NOW()
  WHERE id = card1_id;
  
  UPDATE cards SET position = card1_position, updated_at = NOW()
  WHERE id = card2_id;
END;
$$ LANGUAGE plpgsql;
