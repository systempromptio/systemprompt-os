-- API module database schema

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    scopes TEXT DEFAULT '[]',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    metadata TEXT DEFAULT '{}'
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS api_rate_limits (
    key_id TEXT NOT NULL,
    window_start TIMESTAMP NOT NULL,
    window_size INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    rate_limit INTEGER NOT NULL,
    PRIMARY KEY (key_id, window_start),
    FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- API request logs table
CREATE TABLE IF NOT EXISTS api_requests (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_id ON api_rate_limits(key_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_api_requests_key_id ON api_requests(key_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_timestamp ON api_requests(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON api_requests(endpoint, method);