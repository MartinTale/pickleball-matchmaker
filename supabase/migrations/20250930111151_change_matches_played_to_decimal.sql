-- Change matches_played from INTEGER to NUMERIC to support fractional values
ALTER TABLE players ALTER COLUMN matches_played TYPE NUMERIC(10, 2);