-- Auth Module Database Schema
-- This file defines all tables needed for authentication and authorization

-- Users table
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  is_active INTEGER DEFAULT 1
);

-- OAuth identities table
CREATE TABLE IF NOT EXISTS auth_oauth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_data TEXT, -- JSON data
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS auth_roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Permissions table
CREATE TABLE IF NOT EXISTS auth_permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(resource, action)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS auth_user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  granted_at TEXT DEFAULT (datetime('now')),
  granted_by TEXT,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES auth_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS auth_role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES auth_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES auth_permissions(id) ON DELETE CASCADE
);

-- Sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_accessed_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- Authorization codes table for OAuth flow
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_user_id ON auth_oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_provider ON auth_oauth_identities(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id ON auth_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role_id ON auth_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_role_id ON auth_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_authorization_codes_expires_at ON auth_authorization_codes(expires_at);