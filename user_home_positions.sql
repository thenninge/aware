-- Create user_home_positions table for storing user's home position per team
CREATE TABLE IF NOT EXISTS user_home_positions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- NextAuth user ID
  team_id TEXT NOT NULL, -- Team ID
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, team_id) -- One home position per user per team
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_home_positions_user_id ON user_home_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_home_positions_team_id ON user_home_positions(team_id);
CREATE INDEX IF NOT EXISTS idx_user_home_positions_user_team ON user_home_positions(user_id, team_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_home_positions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own home positions
CREATE POLICY "Users can view their own home positions" ON user_home_positions
  FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own home positions
CREATE POLICY "Users can insert their own home positions" ON user_home_positions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own home positions
CREATE POLICY "Users can update their own home positions" ON user_home_positions
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own home positions
CREATE POLICY "Users can delete their own home positions" ON user_home_positions
  FOR DELETE USING (auth.uid()::text = user_id);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_home_positions_updated_at 
  BEFORE UPDATE ON user_home_positions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraints (optional, but good practice)
-- Note: These will only work if the teams table exists and has the correct structure
-- ALTER TABLE user_home_positions 
--   ADD CONSTRAINT fk_user_home_positions_team_id 
--   FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- Insert some sample data (optional - remove if not needed)
-- INSERT INTO user_home_positions (user_id, team_id, latitude, longitude) VALUES
--   ('sample-user-1', 'sample-team-1', 59.9139, 10.7522), -- Oslo
--   ('sample-user-1', 'sample-team-2', 60.3913, 5.3221),  -- Bergen
--   ('sample-user-2', 'sample-team-1', 63.4305, 10.3951); -- Trondheim
-- ON CONFLICT (user_id, team_id) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON user_home_positions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_home_positions_id_seq TO authenticated;
