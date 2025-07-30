-- Auth Module Database Schema
-- Handles all authentication, authorization, and security concerns

-- Remove duplicate auth_users table - users are managed in users module
-- Auth module references users.id for all auth-related data

-- Authentication credentials
CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id TEXT PRIMARY KEY,
    password_hash TEXT,
    last_password_change DATETIME,
    login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_login_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth identities table
CREATE TABLE IF NOT EXISTS auth_oauth_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_name TEXT,
    provider_picture TEXT,
    provider_locale TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

-- Unified sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    refresh_token_hash TEXT UNIQUE,
    type TEXT DEFAULT 'web', -- 'web', 'api', 'oauth'
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    refresh_expires_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Unified tokens table (API keys, personal tokens, etc)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'api', 'personal', 'service'
    expires_at DATETIME,
    last_used_at DATETIME,
    is_revoked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Token scopes table (normalized)
CREATE TABLE IF NOT EXISTS auth_token_scopes (
    token_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    PRIMARY KEY (token_id, scope),
    FOREIGN KEY (token_id) REFERENCES auth_tokens(id) ON DELETE CASCADE
);

-- MFA settings
CREATE TABLE IF NOT EXISTS auth_mfa (
    user_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    secret TEXT,
    recovery_email TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA backup codes table (normalized)
CREATE TABLE IF NOT EXISTS auth_mfa_backup_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    expires_at DATETIME,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES auth_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS auth_role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES auth_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES auth_permissions(id) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    ip_address TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL,
    error_message TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
    provider_tokens TEXT,
    code_challenge TEXT,
    code_challenge_method TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_credentials_user_id ON auth_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_user_id ON auth_oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_provider ON auth_oauth_identities(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens(type);
CREATE INDEX IF NOT EXISTS idx_auth_mfa_user_id ON auth_mfa(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id ON auth_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role_id ON auth_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_role_id ON auth_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_timestamp ON auth_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_authorization_codes_expires_at ON auth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user_id ON auth_password_reset_tokens(user_id);