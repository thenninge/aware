-- Update posts table to include all necessary columns for team-based functionality
-- First, let's see what we have and add missing columns

-- Add category column if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Add teamid column if it doesn't exist  
ALTER TABLE posts ADD COLUMN IF NOT EXISTS teamid uuid;

-- Add createdby column if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS createdby text;

-- Add foreign key constraint for teamid
ALTER TABLE posts ADD CONSTRAINT IF NOT EXISTS posts_teamid_fkey 
  FOREIGN KEY (teamid) REFERENCES teams(id) ON DELETE CASCADE;

-- Update existing posts to have default values
UPDATE posts SET category = 'general' WHERE category IS NULL;
UPDATE posts SET createdby = 'system' WHERE createdby IS NULL;

-- Make category NOT NULL after setting defaults
ALTER TABLE posts ALTER COLUMN category SET NOT NULL;
