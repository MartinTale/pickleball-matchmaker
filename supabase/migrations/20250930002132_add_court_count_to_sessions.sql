-- Add court_count column to sessions table
ALTER TABLE sessions ADD COLUMN court_count INTEGER NOT NULL DEFAULT 1;

-- Add check constraint to ensure court_count is positive
ALTER TABLE sessions ADD CONSTRAINT court_count_positive CHECK (court_count > 0);