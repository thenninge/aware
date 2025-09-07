-- Add local_id columns to existing tables for sync functionality
-- This allows us to track which records were created locally vs server-side

-- Add local_id to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS local_id TEXT;

-- Add local_id to finds table  
ALTER TABLE finds ADD COLUMN IF NOT EXISTS local_id TEXT;

-- Add local_id to observations table
ALTER TABLE observations ADD COLUMN IF NOT EXISTS local_id TEXT;

-- Add local_id to posts table (for skuddpar)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS local_id TEXT;

-- Create indexes for better performance on local_id lookups
CREATE INDEX IF NOT EXISTS idx_tracks_local_id ON tracks(local_id);
CREATE INDEX IF NOT EXISTS idx_finds_local_id ON finds(local_id);
CREATE INDEX IF NOT EXISTS idx_observations_local_id ON observations(local_id);
CREATE INDEX IF NOT EXISTS idx_posts_local_id ON posts(local_id);

-- Grant permissions to service_role
GRANT ALL ON TABLE tracks TO service_role;
GRANT ALL ON TABLE finds TO service_role;
GRANT ALL ON TABLE observations TO service_role;
GRANT ALL ON TABLE posts TO service_role;
