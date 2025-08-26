/*
  # Create user favorites table

  1. New Tables
    - `user_favorites`
      - `id` (uuid, primary key)
      - `smartuser_id` (text, foreign key to users)
      - `content_id` (integer, ID of the favorited content)
      - `content_type` (text, either 'serie' or 'episode')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_favorites` table
    - Add policies for authenticated users to manage their own favorites
    - Add policy for service role to manage all favorites

  3. Indexes
    - Index on smartuser_id for efficient user queries
    - Index on content_id and content_type for efficient content queries
    - Unique constraint on smartuser_id + content_id + content_type to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smartuser_id text NOT NULL,
  content_id integer NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('serie', 'episode')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(smartuser_id, content_id, content_type)
);

-- Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint
ALTER TABLE user_favorites 
ADD CONSTRAINT user_favorites_smartuser_id_fkey 
FOREIGN KEY (smartuser_id) REFERENCES users(smartuser_id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_favorites_smartuser_id 
ON user_favorites(smartuser_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_content 
ON user_favorites(content_id, content_type);

CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at 
ON user_favorites(created_at);

-- RLS Policies
CREATE POLICY "Users can manage own favorites"
  ON user_favorites
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = smartuser_id)
  WITH CHECK (auth.uid()::text = smartuser_id);

CREATE POLICY "Service role can manage all favorites"
  ON user_favorites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_user_favorites_updated_at
  BEFORE UPDATE ON user_favorites
  FOR EACH ROW
  EXECUTE FUNCTION update_user_favorites_updated_at();