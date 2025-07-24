-- Authorization codes table
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
    created_at TEXT DEFAULT (datetime('now'))
);