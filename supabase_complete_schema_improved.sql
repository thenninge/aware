-- =====================================================
-- AWARE COMPLETE DATABASE SCHEMA (IMPROVED VERSION)
-- =====================================================

-- Create enum types for better validation
CREATE TYPE team_role_enum AS ENUM ('owner', 'admin', 'member');
CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Helper function for team-based policies (security definer)
CREATE OR REPLACE FUNCTION get_user_teams()
RETURNS TABLE(team_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM teams t
  WHERE t.ownerId = (SELECT auth.uid())
  UNION
  SELECT tm.teamId
  FROM team_members tm
  WHERE tm.userId = (SELECT auth.uid())
$$;

-- Revoke execution from public roles
REVOKE EXECUTE ON FUNCTION get_user_teams() FROM anon, authenticated;

-- =====================================================
-- TEAMS SYSTEM
-- =====================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  ownerId TEXT NOT NULL, -- Google ID
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  userId TEXT NOT NULL, -- Google ID
  role team_role_enum NOT NULL DEFAULT 'member',
  joinedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teamId, userId)
);

-- Team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invitedUserId TEXT NOT NULL, -- Google ID
  invitedBy TEXT NOT NULL, -- Google ID
  role team_role_enum NOT NULL DEFAULT 'member',
  status invitation_status_enum NOT NULL DEFAULT 'pending',
  expiresAt TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teamId, invitedUserId)
);

-- =====================================================
-- POSTS TABLE (UPDATE EXISTING)
-- =====================================================

-- Ensure posts.id is properly defined as BIGINT
ALTER TABLE posts ALTER COLUMN id TYPE BIGINT;
ALTER TABLE posts ALTER COLUMN id SET NOT NULL;

-- Add missing columns to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS teamId UUID REFERENCES teams(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS createdBy TEXT, -- Google ID
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- TRACKS, FINDS, AND OBSERVATIONS
-- =====================================================

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL,
  color TEXT DEFAULT '#10B981',
  points JSONB NOT NULL, -- Array of {lat, lng} objects
  shotPairId BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finds table
CREATE TABLE IF NOT EXISTS finds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL,
  color TEXT DEFAULT '#F59E0B',
  position JSONB NOT NULL, -- {lat, lng} object
  shotPairId BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  position JSONB NOT NULL, -- {lat, lng} object
  shotPairId BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(ownerId);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(createdAt);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(teamId);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(userId);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Team invitations indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(teamId);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user ON team_invitations(invitedUserId);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON team_invitations(expiresAt);

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_team ON posts(teamId);
CREATE INDEX IF NOT EXISTS idx_posts_created_by ON posts(createdBy);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(createdAt);
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updatedAt);
CREATE INDEX IF NOT EXISTS idx_posts_team_created_by ON posts(teamId, createdBy);

-- Tracks indexes
CREATE INDEX IF NOT EXISTS idx_tracks_team ON tracks(teamId);
CREATE INDEX IF NOT EXISTS idx_tracks_created_by ON tracks(createdBy);
CREATE INDEX IF NOT EXISTS idx_tracks_shot_pair ON tracks(shotPairId);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(createdAt);
CREATE INDEX IF NOT EXISTS idx_tracks_team_created_by ON tracks(teamId, createdBy);

-- Finds indexes
CREATE INDEX IF NOT EXISTS idx_finds_team ON finds(teamId);
CREATE INDEX IF NOT EXISTS idx_finds_created_by ON finds(createdBy);
CREATE INDEX IF NOT EXISTS idx_finds_shot_pair ON finds(shotPairId);
CREATE INDEX IF NOT EXISTS idx_finds_created_at ON finds(createdAt);
CREATE INDEX IF NOT EXISTS idx_finds_team_created_by ON finds(teamId, createdBy);

-- Observations indexes
CREATE INDEX IF NOT EXISTS idx_observations_team ON observations(teamId);
CREATE INDEX IF NOT EXISTS idx_observations_created_by ON observations(createdBy);
CREATE INDEX IF NOT EXISTS idx_observations_shot_pair ON observations(shotPairId);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(createdAt);
CREATE INDEX IF NOT EXISTS idx_observations_team_created_by ON observations(teamId, createdBy);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view teams they own or are members of" ON teams
  FOR SELECT USING (id IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (ownerId = (SELECT auth.uid()));

CREATE POLICY "Team owners can update their teams" ON teams
  FOR UPDATE USING (ownerId = (SELECT auth.uid()));

CREATE POLICY "Team owners can delete their teams" ON teams
  FOR DELETE USING (ownerId = (SELECT auth.uid()));

-- Team members policies
CREATE POLICY "Users can view team members of their teams" ON team_members
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team owners can add members" ON team_members
  FOR INSERT WITH CHECK (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

CREATE POLICY "Team owners can update member roles" ON team_members
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

CREATE POLICY "Team owners can remove members" ON team_members
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

-- Team invitations policies
CREATE POLICY "Users can view invitations to their teams" ON team_invitations
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team owners can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

CREATE POLICY "Team owners can update invitations" ON team_invitations
  FOR UPDATE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

CREATE POLICY "Team owners can delete invitations" ON team_invitations
  FOR DELETE USING (
    teamId IN (SELECT id FROM teams WHERE ownerId = (SELECT auth.uid()))
  );

-- Posts policies
CREATE POLICY "Users can view posts from their teams" ON posts
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team members can create posts" ON posts
  FOR INSERT WITH CHECK (
    teamId IN (SELECT team_id FROM get_user_teams()) AND
    createdBy = (SELECT auth.uid())
  );

CREATE POLICY "Post creators can update their posts" ON posts
  FOR UPDATE USING (createdBy = (SELECT auth.uid()));

CREATE POLICY "Post creators can delete their posts" ON posts
  FOR DELETE USING (createdBy = (SELECT auth.uid()));

-- Tracks policies
CREATE POLICY "Users can view tracks from their teams" ON tracks
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team members can create tracks" ON tracks
  FOR INSERT WITH CHECK (
    teamId IN (SELECT team_id FROM get_user_teams()) AND
    createdBy = (SELECT auth.uid())
  );

CREATE POLICY "Track creators can update their tracks" ON tracks
  FOR UPDATE USING (createdBy = (SELECT auth.uid()));

CREATE POLICY "Track creators can delete their tracks" ON tracks
  FOR DELETE USING (createdBy = (SELECT auth.uid()));

-- Finds policies
CREATE POLICY "Users can view finds from their teams" ON finds
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team members can create finds" ON finds
  FOR INSERT WITH CHECK (
    teamId IN (SELECT team_id FROM get_user_teams()) AND
    createdBy = (SELECT auth.uid())
  );

CREATE POLICY "Find creators can update their finds" ON finds
  FOR UPDATE USING (createdBy = (SELECT auth.uid()));

CREATE POLICY "Find creators can delete their finds" ON finds
  FOR DELETE USING (createdBy = (SELECT auth.uid()));

-- Observations policies
CREATE POLICY "Users can view observations from their teams" ON observations
  FOR SELECT USING (teamId IN (SELECT team_id FROM get_user_teams()));

CREATE POLICY "Team members can create observations" ON observations
  FOR INSERT WITH CHECK (
    teamId IN (SELECT team_id FROM get_user_teams()) AND
    createdBy = (SELECT auth.uid())
  );

CREATE POLICY "Observation creators can update their observations" ON observations
  FOR UPDATE USING (createdBy = (SELECT auth.uid()));

CREATE POLICY "Observation creators can delete their observations" ON observations
  FOR DELETE USING (createdBy = (SELECT auth.uid()));

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Function to update updatedAt column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updatedAt
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finds_updated_at BEFORE UPDATE ON finds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_observations_updated_at BEFORE UPDATE ON observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE teams IS 'Teams that users can create and join';
COMMENT ON TABLE team_members IS 'Membership information for teams';
COMMENT ON TABLE team_invitations IS 'Invitations to join teams';
COMMENT ON TABLE tracks IS 'GPS tracks with multiple points';
COMMENT ON TABLE finds IS 'Individual finds with single position';
COMMENT ON TABLE observations IS 'Free observations with single position';

COMMENT ON COLUMN teams.ownerId IS 'Google ID of the team owner';
COMMENT ON COLUMN team_members.userId IS 'Google ID of the team member';
COMMENT ON COLUMN team_invitations.invitedUserId IS 'Google ID of the invited user';
COMMENT ON COLUMN team_invitations.invitedBy IS 'Google ID of the user who sent the invitation';
COMMENT ON COLUMN posts.createdBy IS 'Google ID of the post creator';
COMMENT ON COLUMN tracks.createdBy IS 'Google ID of the track creator';
COMMENT ON COLUMN finds.createdBy IS 'Google ID of the find creator';
COMMENT ON COLUMN observations.createdBy IS 'Google ID of the observation creator';

COMMENT ON COLUMN tracks.points IS 'Array of {lat, lng} objects representing the track path';
COMMENT ON COLUMN finds.position IS 'Single {lat, lng} object representing the find location';
COMMENT ON COLUMN observations.position IS 'Single {lat, lng} object representing the observation location';

COMMENT ON COLUMN tracks.shotPairId IS 'Can be NULL for free tracks';
COMMENT ON COLUMN finds.shotPairId IS 'Can be NULL for free finds';
COMMENT ON COLUMN observations.shotPairId IS 'Can be NULL for free observations';
