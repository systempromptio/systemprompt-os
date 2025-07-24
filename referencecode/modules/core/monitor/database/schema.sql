-- Module: monitor
-- Version: 1.0.0
-- Description: Schema for monitoring metrics, alerts, and traces

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('counter', 'gauge', 'histogram', 'summary')) NOT NULL,
  value REAL NOT NULL,
  labels TEXT DEFAULT '{}', -- JSON object
  timestamp DATETIME NOT NULL,
  unit TEXT,
  description TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('critical', 'warning', 'info')) NOT NULL,
  condition TEXT NOT NULL, -- JSON object
  status TEXT CHECK(status IN ('active', 'acknowledged', 'resolved')) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  acknowledged_at DATETIME,
  acknowledged_by TEXT,
  resolved_at DATETIME,
  metadata TEXT DEFAULT '{}' -- JSON object
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_status ON alerts(severity, status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- Alert configurations table
CREATE TABLE IF NOT EXISTS alert_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  condition TEXT NOT NULL, -- JSON object
  severity TEXT CHECK(severity IN ('critical', 'warning', 'info')) NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]', -- JSON array
  enabled INTEGER DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- Traces table
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER, -- milliseconds
  status TEXT CHECK(status IN ('ok', 'error', 'cancelled')) NOT NULL,
  attributes TEXT DEFAULT '{}', -- JSON object
  events TEXT DEFAULT '[]', -- JSON array
  links TEXT DEFAULT '[]' -- JSON array
);

-- Indexes for traces
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
CREATE INDEX IF NOT EXISTS idx_traces_service_name_start_time ON traces(service_name, start_time);
CREATE INDEX IF NOT EXISTS idx_traces_operation_name_start_time ON traces(operation_name, start_time);
CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);

-- Alert history table (for audit trail)
CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'acknowledged', 'resolved'
  performed_by TEXT,
  performed_at DATETIME NOT NULL,
  notes TEXT,
  FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

-- Metric aggregations table (for performance)
CREATE TABLE IF NOT EXISTS metric_aggregations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  aggregation_type TEXT CHECK(aggregation_type IN ('1m', '5m', '1h', '1d')) NOT NULL,
  timestamp DATETIME NOT NULL,
  avg_value REAL,
  min_value REAL,
  max_value REAL,
  sum_value REAL,
  count INTEGER,
  labels TEXT DEFAULT '{}', -- JSON object
  UNIQUE(metric_name, aggregation_type, timestamp, labels)
);

CREATE INDEX IF NOT EXISTS idx_metric_aggregations_lookup 
  ON metric_aggregations(metric_name, aggregation_type, timestamp);