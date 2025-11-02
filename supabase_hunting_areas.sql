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
DROP POLICY IF EXISTS "Users can view hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can insert hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can update hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can delete hunting areas for their teams" ON hunting_areas;

-- RLS Policies: Allow users to manage hunting areas for their teams
CREATE POLICY "Users can view hunting areas for their teams"
ON hunting_areas FOR SELECT
USING (
  teamid IN (
    SELECT teamid FROM team_members WHERE userid = auth.uid()::text
  )
);

CREATE POLICY "Users can insert hunting areas for their teams"
ON hunting_areas FOR INSERT
WITH CHECK (
  teamid IN (
    SELECT teamid FROM team_members WHERE userid = auth.uid()::text
  )
);

CREATE POLICY "Users can update hunting areas for their teams"
ON hunting_areas FOR UPDATE
USING (
  teamid IN (
    SELECT teamid FROM team_members WHERE userid = auth.uid()::text
  )
);

CREATE POLICY "Users can delete hunting areas for their teams"
ON hunting_areas FOR DELETE
USING (
  teamid IN (
    SELECT teamid FROM team_members WHERE userid = auth.uid()::text
  )
);

