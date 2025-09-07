-- Add shot_pair_id column to tracks table
ALTER TABLE tracks
ADD COLUMN shot_pair_id TEXT;

-- Add shot_pair_id column to finds table
ALTER TABLE finds
ADD COLUMN shot_pair_id TEXT;

-- Add color column to finds table
ALTER TABLE finds
ADD COLUMN color TEXT;

-- Add shot_pair_id column to observations table
ALTER TABLE observations
ADD COLUMN shot_pair_id TEXT;

-- Add color column to observations table
ALTER TABLE observations
ADD COLUMN color TEXT;

-- Grant service_role access to the new columns
GRANT ALL ON TABLE tracks TO service_role;
GRANT ALL ON TABLE finds TO service_role;
GRANT ALL ON TABLE observations TO service_role;
