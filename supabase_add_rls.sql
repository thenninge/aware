-- =====================================================
-- ADD RLS POLICIES TO EXISTING TABLES
-- =====================================================

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Teams policies - Simple and clean
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    ownerid = (SELECT auth.jwt() ->> 'sub') OR
    id IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (ownerid = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Team owners can update teams" ON teams
  FOR UPDATE USING (ownerid = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Team owners can delete teams" ON teams
  FOR DELETE USING (ownerid = (SELECT auth.jwt() ->> 'sub'));

-- Team members policies - Simple and clean
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team owners can add members" ON team_members
  FOR INSERT WITH CHECK (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team owners can remove members" ON team_members
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub'))
  );

-- Posts policies - All team members have admin rights
CREATE POLICY "Team members can view posts" ON posts
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create posts" ON posts
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))) AND
    createdby = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update posts" ON posts
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete posts" ON posts
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

-- Tracks policies - All team members have admin rights
CREATE POLICY "Team members can view tracks" ON tracks
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create tracks" ON tracks
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))) AND
    createdby = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update tracks" ON tracks
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete tracks" ON tracks
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

-- Finds policies - All team members have admin rights
CREATE POLICY "Team members can view finds" ON finds
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create finds" ON finds
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))) AND
    createdby = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update finds" ON finds
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete finds" ON finds
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

-- Observations policies - All team members have admin rights
CREATE POLICY "Team members can view observations" ON observations
  FOR SELECT USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create observations" ON observations
  FOR INSERT WITH CHECK (
    (teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
     teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))) AND
    createdby = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update observations" ON observations
  FOR UPDATE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete observations" ON observations
  FOR DELETE USING (
    teamid IN (SELECT id FROM teams WHERE ownerid = (SELECT auth.jwt() ->> 'sub')) OR
    teamid IN (SELECT teamid FROM team_members WHERE userid = (SELECT auth.jwt() ->> 'sub'))
  );
