-- =====================================================
-- AWARE COMPLETE DATABASE SCHEMA (FIXED VERSION)
-- =====================================================

-- Drop ALL existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view teams they own" ON teams;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON teams;
DROP POLICY IF EXISTS "Team owners can delete their teams" ON teams;

DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Team owners can add members" ON team_members;
DROP POLICY IF EXISTS "Team owners can update members" ON team_members;
DROP POLICY IF EXISTS "Team owners can remove members" ON team_members;

DROP POLICY IF EXISTS "Users can view invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team owners can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team owners can update invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team owners can delete invitations" ON team_invitations;

DROP POLICY IF EXISTS "Users can view posts from their teams" ON posts;
DROP POLICY IF EXISTS "Team members can create posts" ON posts;
DROP POLICY IF EXISTS "Post creators can update their posts" ON posts;
DROP POLICY IF EXISTS "Post creators can delete their posts" ON posts;

DROP POLICY IF EXISTS "Users can view tracks from their teams" ON tracks;
DROP POLICY IF EXISTS "Team members can create tracks" ON tracks;
DROP POLICY IF EXISTS "Track creators can update their tracks" ON tracks;
DROP POLICY IF EXISTS "Track creators can delete their tracks" ON tracks;

DROP POLICY IF EXISTS "Users can view finds from their teams" ON finds;
DROP POLICY IF EXISTS "Team members can create finds" ON finds;
DROP POLICY IF EXISTS "Find creators can update their finds" ON finds;
DROP POLICY IF EXISTS "Find creators can delete their finds" ON finds;

DROP POLICY IF EXISTS "Users can view observations from their teams" ON observations;
DROP POLICY IF EXISTS "Team members can create observations" ON observations;
DROP POLICY IF EXISTS "Observation creators can update their observations" ON observations;
DROP POLICY IF EXISTS "Observation creators can delete their observations" ON observations;

-- Drop the helper function if it exists
DROP FUNCTION IF EXISTS get_user_teams();

-- Create enum types for better validation
CREATE TYPE team_role_enum AS ENUM ('owner', 'admin', 'member');
CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- =====================================================
-- SIMPLIFIED RLS POLICIES (ALL TEAM MEMBERS HAVE ADMIN RIGHTS)
-- =====================================================

-- Teams policies - All team members can view, update, delete teams
CREATE POLICY "Team members can view teams" ON teams
  FOR SELECT USING (
    ownerId = (SELECT auth.jwt() ->> 'sub') OR
    id IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (ownerId = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Team members can update teams" ON teams
  FOR UPDATE USING (
    ownerId = (SELECT auth.jwt() ->> 'sub') OR
    id IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete teams" ON teams
  FOR DELETE USING (
    ownerId = (SELECT auth.jwt() ->> 'sub') OR
    id IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Team members policies - All team members have admin rights
CREATE POLICY "Team members can view team members" ON team_members
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub')) OR
    userId = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can add members" ON team_members
  FOR INSERT WITH CHECK (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can update members" ON team_members
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can remove members" ON team_members
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Team invitations policies - All team members have admin rights
CREATE POLICY "Team members can view invitations" ON team_invitations
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can update invitations" ON team_invitations
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete invitations" ON team_invitations
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Posts policies - All team members have admin rights
CREATE POLICY "Team members can view posts" ON posts
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create posts" ON posts
  FOR INSERT WITH CHECK (
    (teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
     teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))) AND
    createdBy = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update posts" ON posts
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete posts" ON posts
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Tracks policies - All team members have admin rights
CREATE POLICY "Team members can view tracks" ON tracks
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create tracks" ON tracks
  FOR INSERT WITH CHECK (
    (teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
     teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))) AND
    createdBy = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update tracks" ON tracks
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete tracks" ON tracks
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Finds policies - All team members have admin rights
CREATE POLICY "Team members can view finds" ON finds
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create finds" ON finds
  FOR INSERT WITH CHECK (
    (teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
     teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))) AND
    createdBy = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update finds" ON finds
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete finds" ON finds
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

-- Observations policies - All team members have admin rights
CREATE POLICY "Team members can view observations" ON observations
  FOR SELECT USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can create observations" ON observations
  FOR INSERT WITH CHECK (
    (teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
     teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))) AND
    createdBy = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY "Team members can update observations" ON observations
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Team members can delete observations" ON observations
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.jwt() ->> 'sub')) OR
    teamId IN (SELECT teamId FROM team_members WHERE userId = (SELECT auth.jwt() ->> 'sub'))
  );
