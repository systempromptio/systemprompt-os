-- Development module schema
-- Structured storage for development tools module

CREATE TABLE IF NOT EXISTS dev_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config_enabled INTEGER DEFAULT 1,
    config_auto_save INTEGER DEFAULT 0,
    config_debug_mode INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dev_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT NOT NULL, -- 'repl', 'profile', 'test', 'watch', 'lint', 'typecheck'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    exit_code INTEGER,
    output_lines INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES dev_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_profile ON dev_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_type ON dev_sessions(type);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_status ON dev_sessions(status);