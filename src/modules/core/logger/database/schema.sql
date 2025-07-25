-- Logger Module Database Schema

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, -- ISO timestamp
  level TEXT NOT NULL, -- debug, info, warn, error
  source TEXT NOT NULL, -- Module or component that generated the log
  category TEXT, -- Optional category for grouping (e.g., 'bootstrap', 'cli', 'auth')
  message TEXT NOT NULL,
  args TEXT NOT NULL, -- JSON serialized args including session_id, user_id, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- Access logs table (for HTTP requests, API calls, etc.)
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT,
  url TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for access logs
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON access_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id);