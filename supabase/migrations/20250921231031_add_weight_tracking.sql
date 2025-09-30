-- Add weight tracking fields to players table
ALTER TABLE players ADD COLUMN last_match_round INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN matches_played INTEGER DEFAULT 0;

-- Create a table to track player partnerships and opponents
CREATE TABLE IF NOT EXISTS player_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  other_player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('partner', 'opponent')),
  count INTEGER DEFAULT 1,
  last_round INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(session_id, player_id, other_player_id, relationship_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_player_history_session_player ON player_history(session_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_history_relationship ON player_history(session_id, player_id, relationship_type);

-- Enable Realtime on player_history table
ALTER PUBLICATION supabase_realtime ADD TABLE player_history;