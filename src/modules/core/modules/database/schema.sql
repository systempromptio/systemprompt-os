-- Modules database schema
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  type TEXT CHECK(type IN ('core', 'service', 'daemon', 'plugin', 'extension')) NOT NULL,
  path TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  auto_start BOOLEAN DEFAULT 0,
  dependencies TEXT, -- JSON array of dependency module names
  config TEXT, -- JSON configuration
  status TEXT CHECK(status IN ('installed', 'loading', 'running', 'stopped', 'error')) DEFAULT 'installed',
  lasterror TEXT,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_started_at TIMESTAMP,
  last_stopped_at TIMESTAMP,
  health_status TEXT CHECK(health_status IN ('healthy', 'unhealthy', 'unknown')) DEFAULT 'unknown',
  health_message TEXT,
  last_health_check TIMESTAMP,
  metadata TEXT, -- JSON metadata from module.yaml
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Module events/history
CREATE TABLE IF NOT EXISTS module_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  event_type TEXT CHECK(event_type IN ('discovered', 'installed', 'started', 'stopped', 'error', 'health_check', 'config_changed')) NOT NULL,
  event_data TEXT, -- JSON data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- Module dependencies
CREATE TABLE IF NOT EXISTS module_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  dependency_name TEXT NOT NULL,
  required BOOLEAN DEFAULT 1,
  version_constraint TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE(module_id, dependency_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);
CREATE INDEX IF NOT EXISTS idx_modules_enabled ON modules(enabled);
CREATE INDEX IF NOT EXISTS idx_modules_type ON modules(type);
CREATE INDEX IF NOT EXISTS idx_module_events_module_id ON module_events(module_id);
CREATE INDEX IF NOT EXISTS idx_module_events_type ON module_events(event_type);
CREATE INDEX IF NOT EXISTS idx_module_dependencies_module_id ON module_dependencies(module_id);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_modules_timestamp 
AFTER UPDATE ON modules
BEGIN
  UPDATE modules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;