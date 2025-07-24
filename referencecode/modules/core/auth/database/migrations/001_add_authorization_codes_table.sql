-- Migration: Add authorization codes table for OAuth flow
-- Version: 001
-- Description: Creates auth_authorization_codes table for storing OAuth authorization codes

-- Create authorization codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  provider TEXT,
  provider_tokens TEXT, -- JSON data
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auth_authorization_codes_expires_at ON auth_authorization_codes(expires_at);