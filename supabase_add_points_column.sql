-- Add points column to tracks table
ALTER TABLE tracks
ADD COLUMN points TEXT;

-- Add points column to finds table (for position data)
ALTER TABLE finds
ADD COLUMN position TEXT;

-- Add points column to observations table (for position data)
ALTER TABLE observations
ADD COLUMN position TEXT;

-- Grant service_role access to the new columns
GRANT ALL ON TABLE tracks TO service_role;
GRANT ALL ON TABLE finds TO service_role;
GRANT ALL ON TABLE observations TO service_role;
