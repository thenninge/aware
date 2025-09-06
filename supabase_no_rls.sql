-- =====================================================
-- SIMPLE SCHEMA WITHOUT RLS (FOR TESTING)
-- =====================================================

-- Teams table
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ownerid TEXT NOT NULL, -- Google ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamid UUID REFERENCES teams(id) ON DELETE CASCADE,
  userid TEXT NOT NULL, -- Google ID
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamid UUID REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  createdby TEXT NOT NULL, -- Google ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tracks table
CREATE TABLE tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamid UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#000000',
  createdby TEXT NOT NULL, -- Google ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finds table
CREATE TABLE finds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamid UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#000000',
  createdby TEXT NOT NULL, -- Google ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Observations table
CREATE TABLE observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamid UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#000000',
  createdby TEXT NOT NULL, -- Google ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO RLS POLICIES - Just basic tables for testing
