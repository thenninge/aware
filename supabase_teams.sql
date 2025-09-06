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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(ownerId);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(teamId);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(userId);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(teamId);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);

-- RLS (Row Level Security) policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

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
