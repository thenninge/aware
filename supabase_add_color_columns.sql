-- Add color column to finds table
ALTER TABLE finds
ADD COLUMN color TEXT;

-- Add color column to observations table
ALTER TABLE observations
ADD COLUMN color TEXT;

-- Grant service_role access to the new columns
GRANT ALL ON TABLE finds TO service_role;
GRANT ALL ON TABLE observations TO service_role;
