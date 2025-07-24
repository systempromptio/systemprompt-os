-- Development module schema
-- Placeholder schema for development tools module

CREATE TABLE IF NOT EXISTS dev_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dev_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT NOT NULL, -- 'debug', 'repl', 'profile', etc.
    status TEXT NOT NULL DEFAULT 'active',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    metadata TEXT,
    FOREIGN KEY (profile_id) REFERENCES dev_profiles(id)
);

CREATE INDEX idx_dev_sessions_profile ON dev_sessions(profile_id);
CREATE INDEX idx_dev_sessions_type ON dev_sessions(type);
CREATE INDEX idx_dev_sessions_status ON dev_sessions(status);