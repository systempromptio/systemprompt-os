-- System module schema
-- Manages system configuration, settings, and metadata

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    is_readonly BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_modules (
    name TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'error')),
    enabled BOOLEAN DEFAULT TRUE,
    metadata TEXT, -- JSON metadata
    initialized_at DATETIME,
    last_health_check DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_maintenance (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('scheduled', 'emergency')),
    reason TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    created_by TEXT,
    notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_config_type ON system_config(type);
CREATE INDEX IF NOT EXISTS idx_system_modules_status ON system_modules(status);
CREATE INDEX IF NOT EXISTS idx_system_modules_enabled ON system_modules(enabled);
CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_maintenance_type ON system_maintenance(type);