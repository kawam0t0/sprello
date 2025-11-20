-- Insert default board
INSERT INTO boards (id, title) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Sprello')
ON CONFLICT (id) DO NOTHING;

-- Insert default lists
INSERT INTO lists (board_id, title, position) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '完了', 0),
  ('550e8400-e29b-41d4-a716-446655440000', 'Aヨミ', 1),
  ('550e8400-e29b-41d4-a716-446655440000', 'Bヨミ', 2),
  ('550e8400-e29b-41d4-a716-446655440000', 'Cヨミ', 3),
  ('550e8400-e29b-41d4-a716-446655440000', '未確定', 4)
ON CONFLICT DO NOTHING;
