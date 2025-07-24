-- Monitor module schema
-- Tracks system metrics, alerts, and performance data

CREATE TABLE IF NOT EXISTS monitor_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network', 'custom')),
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    unit TEXT,
    metadata TEXT, -- JSON metadata
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitor_alerts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    metric_type TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    comparison TEXT NOT NULL CHECK (comparison IN ('gt', 'gte', 'lt', 'lte', 'eq', 'neq')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitor_alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id TEXT NOT NULL,
    metric_value REAL NOT NULL,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    notification_sent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (alert_id) REFERENCES monitor_alerts(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitor_metrics_type ON monitor_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_monitor_metrics_name ON monitor_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_monitor_metrics_recorded_at ON monitor_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_monitor_alerts_enabled ON monitor_alerts(enabled);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_history_alert_id ON monitor_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_history_triggered_at ON monitor_alert_history(triggered_at);