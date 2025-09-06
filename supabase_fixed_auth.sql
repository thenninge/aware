-- =====================================================
-- FIXED AUTH SCHEMA - Using auth.uid() correctly
-- =====================================================

-- First, let's drop existing policies
DROP POLICY IF EXISTS "Users can view their teams" ON teams;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Team owners can update teams" ON teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON teams;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Team owners can add members" ON team_members;
DROP POLICY IF EXISTS "Team owners can remove members" ON team_members;
DROP POLICY IF EXISTS "Team members can view posts" ON posts;
DROP POLICY IF EXISTS "Team members can create posts" ON posts;
DROP POLICY IF EXISTS "Team members can update posts" ON posts;
DROP POLICY IF EXISTS "Team members can delete posts" ON posts;
DROP POLICY IF EXISTS "Team members can view tracks" ON tracks;
DROP POLICY IF EXISTS "Team members can create tracks" ON tracks;
DROP POLICY IF EXISTS "Team members can update tracks" ON tracks;
DROP POLICY IF EXISTS "Team members can delete tracks" ON tracks;
DROP POLICY IF EXISTS "Team members can view finds" ON finds;
DROP POLICY IF EXISTS "Team members can create finds" ON finds;
DROP POLICY IF EXISTS "Team members can update finds" ON finds;
DROP POLICY IF EXISTS "Team members can delete finds" ON finds;
DROP POLICY IF EXISTS "Team members can view observations" ON observations;
DROP POLICY IF EXISTS "Team members can create observations" ON observations;
DROP POLICY IF EXISTS "Team members can update observations" ON observations;
DROP POLICY IF EXISTS "Team members can delete observations" ON observations;

-- Now create correct policies using auth.uid() with proper casting
-- Teams policies
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    ownerid = auth.uid()::text OR
    id IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (ownerid = auth.uid()::text);

CREATE POLICY "Team owners can update teams" ON teams
  FOR UPDATE USING (ownerid = auth.uid()::text);

CREATE POLICY "Team owners can delete teams" ON teams
  FOR DELETE USING (ownerid = auth.uid()::text);

-- Team members policies
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team owners can add members" ON team_members
  FOR INSERT WITH CHECK (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text)
  );

CREATE POLICY "Team owners can remove members" ON team_members
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text)
  );

-- Posts policies - All team members have admin rights
CREATE POLICY "Team members can view posts" ON posts
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can create posts" ON posts
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)) AND
    createdby = auth.uid()::text
  );

CREATE POLICY "Team members can update posts" ON posts
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can delete posts" ON posts
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

-- Tracks policies - All team members have admin rights
CREATE POLICY "Team members can view tracks" ON tracks
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can create tracks" ON tracks
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)) AND
    createdby = auth.uid()::text
  );

CREATE POLICY "Team members can update tracks" ON tracks
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can delete tracks" ON tracks
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

-- Finds policies - All team members have admin rights
CREATE POLICY "Team members can view finds" ON finds
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can create finds" ON finds
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)) AND
    createdby = auth.uid()::text
  );

CREATE POLICY "Team members can update finds" ON finds
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can delete finds" ON finds
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

-- Observations policies - All team members have admin rights
CREATE POLICY "Team members can view observations" ON observations
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can create observations" ON observations
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)) AND
    createdby = auth.uid()::text
  );

CREATE POLICY "Team members can update observations" ON observations
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );

CREATE POLICY "Team members can delete observations" ON observations
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = auth.uid()::text) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = auth.uid()::text)
  );
