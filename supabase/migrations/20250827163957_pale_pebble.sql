/*
  # Add WebAuthn credentials table for web biometric authentication

  1. New Tables
    - `user_webauthn_credentials`
      - `id` (uuid, primary key)
      - `smartuser_id` (text, foreign key to users)
      - `credential_id` (text, unique WebAuthn credential identifier)
      - `public_key` (text, base64-encoded public key)
      - `attestation_type` (text, attestation type from registration)
      - `aaguid` (text, authenticator GUID)
      - `sign_count` (integer, signature counter for replay protection)
      - `transports` (text array, supported transport methods)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_webauthn_credentials` table
    - Add policies for users to manage their own credentials
    - Add policy for service role to manage all credentials

  3. Indexes
    - Index on smartuser_id for efficient user queries
    - Index on credential_id for authentication lookups
*/

CREATE TABLE IF NOT EXISTS user_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smartuser_id text NOT NULL REFERENCES users(smartuser_id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  attestation_type text,
  aaguid text,
  sign_count integer NOT NULL DEFAULT 0,
  transports text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint
ALTER TABLE user_webauthn_credentials 
ADD CONSTRAINT user_webauthn_credentials_smartuser_id_fkey 
FOREIGN KEY (smartuser_id) REFERENCES users(smartuser_id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_webauthn_credentials_smartuser_id 
ON user_webauthn_credentials(smartuser_id);

CREATE INDEX IF NOT EXISTS idx_user_webauthn_credentials_credential_id 
ON user_webauthn_credentials(credential_id);

CREATE INDEX IF NOT EXISTS idx_user_webauthn_credentials_created_at 
ON user_webauthn_credentials(created_at);

-- RLS Policies
CREATE POLICY "Users can read their own WebAuthn credentials"
  ON user_webauthn_credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = smartuser_id);

CREATE POLICY "Users can manage their own WebAuthn credentials"
  ON user_webauthn_credentials
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = smartuser_id)
  WITH CHECK (auth.uid()::text = smartuser_id);

CREATE POLICY "Service role can manage all WebAuthn credentials"
  ON user_webauthn_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_webauthn_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_user_webauthn_credentials_updated_at
  BEFORE UPDATE ON user_webauthn_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_webauthn_credentials_updated_at();