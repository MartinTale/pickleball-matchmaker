-- Disable Row Level Security (RLS) for all tables during development
-- This allows anonymous access without authentication
-- TODO: Enable RLS and add proper policies before production launch

ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_history DISABLE ROW LEVEL SECURITY;