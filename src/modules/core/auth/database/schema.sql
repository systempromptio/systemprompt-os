-- Auth Module Database Schema (Authentication Only)
-- Handles OAuth authentication, sessions, and tokens
-- Authorization (roles/permissions) is handled by the permissions module

-- OAuth identities table - connects users to OAuth providers
CREATE TABLE IF NOT EXISTS auth_oauth_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_name TEXT,
    provider_picture TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

-- Sessions table - web sessions and OAuth sessions
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

-- API tokens table - personal access tokens, service tokens
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

-- Token scopes table (normalized) - what each token can access
CREATE TABLE IF NOT EXISTS auth_token_scopes (
    token_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    PRIMARY KEY (token_id, scope),
    FOREIGN KEY (token_id) REFERENCES auth_tokens(id) ON DELETE CASCADE
);

-- Authorization codes table - OAuth2 authorization flow
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

-- OAuth providers table - manages OAuth provider configurations
CREATE TABLE IF NOT EXISTS auth_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'oauth2', 'oidc'
    enabled INTEGER DEFAULT 0,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uri TEXT,
    authorization_endpoint TEXT NOT NULL,
    token_endpoint TEXT NOT NULL,
    userinfo_endpoint TEXT,
    jwks_uri TEXT,
    issuer TEXT,
    discovery_endpoint TEXT,
    scopes TEXT, -- JSON array of scopes
    userinfo_mapping TEXT, -- JSON object for field mapping
    metadata TEXT, -- JSON object for additional config
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_user_id ON auth_oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_provider ON auth_oauth_identities(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens(type);
CREATE INDEX IF NOT EXISTS idx_auth_authorization_codes_expires_at ON auth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_providers_enabled ON auth_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_auth_providers_type ON auth_providers(type);