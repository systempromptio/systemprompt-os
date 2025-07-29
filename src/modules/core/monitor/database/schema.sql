-- Monitor module database schema
-- Provides metrics collection and monitoring for SystemPrompt OS

-- Main metrics table for storing metric data
CREATE TABLE IF NOT EXISTS metric (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  value REAL NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('counter', 'gauge', 'histogram')),
  unit VARCHAR(50),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metric labels table for structured label storage (no JSON)
CREATE TABLE IF NOT EXISTS metric_label (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL,
  label_key VARCHAR(255) NOT NULL,
  label_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (metric_id) REFERENCES metric(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_metric_name ON metric(name);
CREATE INDEX IF NOT EXISTS idx_metric_type ON metric(type);
CREATE INDEX IF NOT EXISTS idx_metric_timestamp ON metric(timestamp);
CREATE INDEX IF NOT EXISTS idx_metric_name_timestamp ON metric(name, timestamp);

CREATE INDEX IF NOT EXISTS idx_metric_label_metric_id ON metric_label(metric_id);
CREATE INDEX IF NOT EXISTS idx_metric_label_key ON metric_label(label_key);
CREATE INDEX IF NOT EXISTS idx_metric_label_key_value ON metric_label(label_key, label_value);

-- System metrics table for structured system monitoring data
CREATE TABLE IF NOT EXISTS system_metric (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cpu_cores INTEGER,
  cpu_usage REAL,
  memory_total INTEGER,
  memory_free INTEGER,
  memory_used INTEGER,
  disk_total INTEGER,
  disk_free INTEGER,
  disk_used INTEGER,
  network_bytes_in INTEGER,
  network_bytes_out INTEGER,
  uptime INTEGER,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for system metrics
CREATE INDEX IF NOT EXISTS idx_system_metric_timestamp ON system_metric(timestamp);