-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  open_date DATE,
  start_date DATE,
  candidate_url TEXT DEFAULT '',
  candidate_url2 TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  company_url TEXT DEFAULT '',
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lists_board_id ON lists(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_lists_position ON lists(board_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(list_id, position);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE boards;
ALTER PUBLICATION supabase_realtime ADD TABLE lists;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
