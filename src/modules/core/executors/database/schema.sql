-- Executors module schema
-- Manages task executors and their execution history

CREATE TABLE IF NOT EXISTS executors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('task', 'process', 'workflow')),
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'stopped', 'error')),
    config TEXT, -- JSON configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS executor_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    executor_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure', 'cancelled')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    output TEXT, -- JSON output
    error TEXT,
    FOREIGN KEY (executor_id) REFERENCES executors(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_executors_type ON executors(type);
CREATE INDEX IF NOT EXISTS idx_executors_status ON executors(status);
CREATE INDEX IF NOT EXISTS idx_executor_runs_executor_id ON executor_runs(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_runs_status ON executor_runs(status);