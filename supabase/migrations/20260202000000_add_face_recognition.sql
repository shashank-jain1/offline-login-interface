-- Create table for storing face recognition data
CREATE TABLE IF NOT EXISTS user_face_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  face_descriptor JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE user_face_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own face data
CREATE POLICY "Users can read own face data"
  ON user_face_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own face data
CREATE POLICY "Users can insert own face data"
  ON user_face_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own face data
CREATE POLICY "Users can update own face data"
  ON user_face_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own face data
CREATE POLICY "Users can delete own face data"
  ON user_face_data
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_face_data_user_id ON user_face_data(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_face_data_updated_at
  BEFORE UPDATE ON user_face_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
