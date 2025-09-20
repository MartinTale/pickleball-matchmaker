-- Add soft delete functionality to players table
ALTER TABLE players ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient filtering of non-deleted players
CREATE INDEX IF NOT EXISTS idx_players_deleted_at ON players(deleted_at) WHERE deleted_at IS NULL;