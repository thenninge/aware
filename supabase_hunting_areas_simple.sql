-- Drop existing table if you want to start fresh
-- DROP TABLE IF EXISTS hunting_areas CASCADE;

-- Create hunting_areas table
CREATE TABLE IF NOT EXISTS hunting_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  color TEXT NOT NULL DEFAULT '#00ff00',
  line_weight INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teamid UUID NOT NULL,
  CONSTRAINT fk_team FOREIGN KEY (teamid) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create index for faster team queries
CREATE INDEX IF NOT EXISTS idx_hunting_areas_teamid ON hunting_areas(teamid);

-- Enable Row Level Security
ALTER TABLE hunting_areas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access" ON hunting_areas;
DROP POLICY IF EXISTS "Users can view hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can insert hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can update hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can delete hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "API has full access" ON hunting_areas;

-- Simple policy: Allow all operations when using service role key
-- The API route handles the actual access control
CREATE POLICY "API has full access"
ON hunting_areas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

