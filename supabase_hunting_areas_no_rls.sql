-- Disable RLS completely - API route handles access control
ALTER TABLE hunting_areas DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Service role has full access" ON hunting_areas;
DROP POLICY IF EXISTS "Users can view hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can insert hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can update hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "Users can delete hunting areas for their teams" ON hunting_areas;
DROP POLICY IF EXISTS "API has full access" ON hunting_areas;

