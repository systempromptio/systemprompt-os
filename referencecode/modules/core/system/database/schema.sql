-- System module database schema

-- System events table
CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system_events
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(type);
CREATE INDEX IF NOT EXISTS idx_system_events_level ON system_events(level);
CREATE INDEX IF NOT EXISTS idx_system_events_module ON system_events(module);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp);

-- System metrics table (for persistent storage)
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    tags TEXT, -- JSON tags
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system_metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(name, timestamp);

-- System health history
CREATE TABLE IF NOT EXISTS system_health_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
    checks TEXT NOT NULL, -- JSON array of check results
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup registry
CREATE TABLE IF NOT EXISTS system_backups (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    version TEXT NOT NULL,
    components TEXT NOT NULL, -- JSON array
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    compressed BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance windows
CREATE TABLE IF NOT EXISTS system_maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System configuration history
CREATE TABLE IF NOT EXISTS system_config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    change_reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled tasks (for future scheduler module integration)
CREATE TABLE IF NOT EXISTS system_scheduled_tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    command TEXT NOT NULL,
    schedule TEXT NOT NULL, -- Cron expression
    enabled BOOLEAN DEFAULT TRUE,
    last_run DATETIME,
    next_run DATETIME,
    last_status TEXT,
    lasterror TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for scheduled tasks
CREATE INDEX IF NOT EXISTS idx_system_scheduled_tasks_enabled ON system_scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_system_scheduled_tasks_next_run ON system_scheduled_tasks(next_run);