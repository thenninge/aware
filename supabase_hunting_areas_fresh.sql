-- Drop table completely and recreate
DROP TABLE IF EXISTS hunting_areas CASCADE;

-- Create hunting_areas table WITHOUT RLS
CREATE TABLE hunting_areas (
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
CREATE INDEX idx_hunting_areas_teamid ON hunting_areas(teamid);

-- Explicitly disable RLS (should be disabled by default)
ALTER TABLE hunting_areas DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'hunting_areas' AND schemaname = 'public';

