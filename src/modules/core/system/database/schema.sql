-- System module schema
-- Manages system configuration, settings, and metadata

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean')),
    description TEXT,
    is_secret INTEGER DEFAULT 0,
    is_readonly INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_modules (
    name TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'error')),
    enabled INTEGER DEFAULT 1,
    initialized_at TEXT,
    last_health_check TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Normalized table for module metadata
CREATE TABLE IF NOT EXISTS system_module_metadata (
    module_name TEXT NOT NULL,
    metadata_key TEXT NOT NULL,
    metadata_value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (module_name, metadata_key),
    FOREIGN KEY (module_name) REFERENCES system_modules(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Normalized table for event metadata
CREATE TABLE IF NOT EXISTS system_event_metadata (
    event_id INTEGER NOT NULL,
    metadata_key TEXT NOT NULL,
    metadata_value TEXT NOT NULL,
    PRIMARY KEY (event_id, metadata_key),
    FOREIGN KEY (event_id) REFERENCES system_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_maintenance (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('scheduled', 'emergency')),
    reason TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
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