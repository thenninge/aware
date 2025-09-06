-- =====================================================
-- AWARE COMPLETE DATABASE SCHEMA
-- =====================================================

-- =====================================================
-- 1. TEAMS & USERS
-- =====================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ownerId TEXT NOT NULL, -- Google ID
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  userId TEXT NOT NULL, -- Google ID
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joinedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  nickname TEXT, -- Team-spesifikk nickname
  UNIQUE(teamId, userId)
);

-- Team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invitedBy TEXT NOT NULL, -- Google ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  expiresAt TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc', now()) + interval '7 days'),
  UNIQUE(teamId, email)
);

-- =====================================================
-- 2. SHOT PAIRS (UPDATED POSTS TABLE)
-- =====================================================

-- Update existing posts table to include team relations
ALTER TABLE posts ADD COLUMN IF NOT EXISTS teamId UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS createdBy TEXT; -- Google ID
ALTER TABLE posts ADD COLUMN IF NOT EXISTS name TEXT; -- Optional name for shot pair
ALTER TABLE posts ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#EF4444'; -- Color for visualization
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- =====================================================
-- 3. TRACKS (SØKESPOR)
-- =====================================================

CREATE TABLE IF NOT EXISTS tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shotPairId INTEGER REFERENCES posts(id) ON DELETE CASCADE, -- Links to shot pair
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL, -- Track name/description
  color TEXT NOT NULL DEFAULT '#EAB308', -- Track color
  points JSONB NOT NULL, -- Array of {lat, lng} positions
  mode TEXT NOT NULL DEFAULT 'søk', -- Mode when created
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =====================================================
-- 4. FINDS (FUNN)
-- =====================================================

CREATE TABLE IF NOT EXISTS finds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shotPairId INTEGER REFERENCES posts(id) ON DELETE CASCADE, -- Links to shot pair
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL, -- Find name/description
  color TEXT NOT NULL DEFAULT '#EF4444', -- Find color
  position JSONB NOT NULL, -- {lat, lng} position
  mode TEXT NOT NULL DEFAULT 'søk', -- Mode when created
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =====================================================
-- 5. OBSERVATIONS (FRIE OBSERVASJONER)
-- =====================================================

CREATE TABLE IF NOT EXISTS observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamId UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shotPairId INTEGER, -- Can be NULL for free observations
  createdBy TEXT NOT NULL, -- Google ID
  name TEXT NOT NULL, -- Observation name/description
  color TEXT NOT NULL DEFAULT '#10B981', -- Observation color
  position JSONB NOT NULL, -- {lat, lng} position
  mode TEXT NOT NULL DEFAULT 'aware', -- Mode when created
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(ownerId);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(isActive);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(teamId);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(userId);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Team invitations indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(teamId);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- Posts indexes (updated)
CREATE INDEX IF NOT EXISTS idx_posts_team ON posts(teamId);
CREATE INDEX IF NOT EXISTS idx_posts_created_by ON posts(createdBy);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- Tracks indexes
CREATE INDEX IF NOT EXISTS idx_tracks_team ON tracks(teamId);
CREATE INDEX IF NOT EXISTS idx_tracks_shot_pair ON tracks(shotPairId);
CREATE INDEX IF NOT EXISTS idx_tracks_created_by ON tracks(createdBy);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(createdAt);

-- Finds indexes
CREATE INDEX IF NOT EXISTS idx_finds_team ON finds(teamId);
CREATE INDEX IF NOT EXISTS idx_finds_shot_pair ON finds(shotPairId);
CREATE INDEX IF NOT EXISTS idx_finds_created_by ON finds(createdBy);
CREATE INDEX IF NOT EXISTS idx_finds_created_at ON finds(createdAt);

-- Observations indexes
CREATE INDEX IF NOT EXISTS idx_observations_team ON observations(teamId);
CREATE INDEX IF NOT EXISTS idx_observations_shot_pair ON observations(shotPairId);
CREATE INDEX IF NOT EXISTS idx_observations_created_by ON observations(createdBy);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(createdAt);

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

-- Teams policies
CREATE POLICY "Users can view teams they are members of" ON teams
  FOR SELECT USING (
    ownerId = auth.jwt() ->> 'sub' OR
    id IN (
      SELECT teamId FROM team_members 
      WHERE userId = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (ownerId = auth.jwt() ->> 'sub');

CREATE POLICY "Team owners can update their teams" ON teams
  FOR UPDATE USING (ownerId = auth.jwt() ->> 'sub');

CREATE POLICY "Team owners can delete their teams" ON teams
  FOR DELETE USING (ownerId = auth.jwt() ->> 'sub');

-- Team members policies
CREATE POLICY "Users can view team members of teams they belong to" ON team_members
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Team owners can add members" ON team_members
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Team owners can update members" ON team_members
  FOR UPDATE USING (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Team owners can remove members" ON team_members
  FOR DELETE USING (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

-- Team invitations policies
CREATE POLICY "Users can view invitations for teams they own" ON team_invitations
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Team owners can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    ) AND
    invitedBy = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Team owners can update invitations" ON team_invitations
  FOR UPDATE USING (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Team owners can delete invitations" ON team_invitations
  FOR DELETE USING (
    teamId IN (
      SELECT id FROM teams WHERE ownerId = auth.jwt() ->> 'sub'
    )
  );

-- Posts policies (updated for team-based access)
CREATE POLICY "Users can view posts from their teams" ON posts
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can create posts in their teams" ON posts
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    ) AND
    createdBy = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (createdBy = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (createdBy = auth.jwt() ->> 'sub');

-- Tracks policies
CREATE POLICY "Users can view tracks from their teams" ON tracks
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can create tracks in their teams" ON tracks
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    ) AND
    createdBy = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Users can update their own tracks" ON tracks
  FOR UPDATE USING (createdBy = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own tracks" ON tracks
  FOR DELETE USING (createdBy = auth.jwt() ->> 'sub');

-- Finds policies
CREATE POLICY "Users can view finds from their teams" ON finds
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can create finds in their teams" ON finds
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    ) AND
    createdBy = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Users can update their own finds" ON finds
  FOR UPDATE USING (createdBy = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own finds" ON finds
  FOR DELETE USING (createdBy = auth.jwt() ->> 'sub');

-- Observations policies
CREATE POLICY "Users can view observations from their teams" ON observations
  FOR SELECT USING (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can create observations in their teams" ON observations
  FOR INSERT WITH CHECK (
    teamId IN (
      SELECT id FROM teams 
      WHERE ownerId = auth.jwt() ->> 'sub' OR
      id IN (
        SELECT teamId FROM team_members 
        WHERE userId = auth.jwt() ->> 'sub'
      )
    ) AND
    createdBy = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Users can update their own observations" ON observations
  FOR UPDATE USING (createdBy = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own observations" ON observations
  FOR DELETE USING (createdBy = auth.jwt() ->> 'sub');

-- =====================================================
-- 9. FUNCTIONS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = timezone('utc', now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updatedAt updates
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
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
-- 10. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE teams IS 'Teams that users can create and join';
COMMENT ON TABLE team_members IS 'Membership information for teams';
COMMENT ON TABLE team_invitations IS 'Invitations to join teams';
COMMENT ON TABLE posts IS 'Shot pairs (current position + target position)';
COMMENT ON TABLE tracks IS 'Search tracks/spor with multiple GPS points';
COMMENT ON TABLE finds IS 'Finds/funn linked to specific shot pairs';
COMMENT ON TABLE observations IS 'Free observations not linked to shot pairs';

COMMENT ON COLUMN posts.teamId IS 'Team that owns this shot pair';
COMMENT ON COLUMN posts.createdBy IS 'Google ID of user who created this shot pair';
COMMENT ON COLUMN posts.name IS 'Optional name for the shot pair';
COMMENT ON COLUMN posts.color IS 'Color for visualization';

COMMENT ON COLUMN tracks.points IS 'JSON array of {lat, lng} positions';
COMMENT ON COLUMN finds.position IS 'JSON object with {lat, lng} position';
COMMENT ON COLUMN observations.position IS 'JSON object with {lat, lng} position';
COMMENT ON COLUMN observations.shotPairId IS 'Can be NULL for free observations';
