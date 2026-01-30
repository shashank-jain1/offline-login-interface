/*
  # Create user_details table for offline-first app

  1. New Tables
    - `user_details`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `age` (integer)
      - `phone` (text)
      - `date_of_birth` (date)
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `user_details` table
    - Add policy for users to read their own details
    - Add policy for users to insert their own details
    - Add policy for users to update their own details

  3. Important Notes
    - Table stores user personal information
    - Uses updated_at for sync conflict resolution
    - Foreign key to auth.users for data integrity
*/

CREATE TABLE IF NOT EXISTS user_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  age integer NOT NULL,
  phone text NOT NULL,
  date_of_birth date NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own details"
  ON user_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own details"
  ON user_details FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own details"
  ON user_details FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_details_user_id_idx ON user_details(user_id);