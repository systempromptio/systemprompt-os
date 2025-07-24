-- Auth Module Database Schema Enhancements
-- Additional tables for MFA, tokens, and audit logging

-- Add MFA columns to auth_users if not exists
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT; -- JSON array
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mfa_secret_temp TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS mfa_backup_codes_temp TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS provider_id TEXT;

-- Auth tokens table for API tokens, personal access tokens, etc.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'access', 'refresh', 'api', 'personal', 'service'
  scope TEXT NOT NULL, -- JSON array of scopes
  expires_at TEXT,
  metadata TEXT, -- JSON metadata
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  is_revoked INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- Enhanced sessions table
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS metadata TEXT; -- JSON
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;

-- Rename token_hash to token if needed
ALTER TABLE auth_sessions RENAME COLUMN token_hash TO token;

-- Auth audit log table
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL, -- 'auth.login', 'auth.logout', 'auth.failed', 'mfa.enable', etc.
  resource TEXT, -- Resource being accessed
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL,
  error_message TEXT,
  metadata TEXT, -- JSON additional data
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- Account recovery codes
CREATE TABLE IF NOT EXISTS auth_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT UNIQUE NOT NULL,
  used_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens(type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_timestamp ON auth_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user_id ON auth_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_recovery_codes_user_id ON auth_recovery_codes(user_id);