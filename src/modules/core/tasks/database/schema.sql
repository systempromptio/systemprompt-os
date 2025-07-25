-- Tasks module database schema
-- Provides task queue and execution tracking for SystemPrompt OS

-- Task queue table
CREATE TABLE IF NOT EXISTS tasks_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(100) NOT NULL,
  module_id VARCHAR(100) NOT NULL,
  payload JSON,
  priority INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  metadata JSON
);

-- Task executions table
CREATE TABLE IF NOT EXISTS tasks_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'timeout', 'cancelled')),
  result JSON,
  error TEXT,
  duration_ms INTEGER,
  executor_id VARCHAR(100),
  FOREIGN KEY (task_id) REFERENCES tasks_queue(id) ON DELETE CASCADE
);

-- Task types registry
CREATE TABLE IF NOT EXISTS tasks_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(100) NOT NULL UNIQUE,
  module_id VARCHAR(100) NOT NULL,
  description TEXT,
  handler_config JSON,
  enabled BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_queue_status ON tasks_queue(status);
CREATE INDEX IF NOT EXISTS idx_tasks_queue_type ON tasks_queue(type);
CREATE INDEX IF NOT EXISTS idx_tasks_queue_module_id ON tasks_queue(module_id);
CREATE INDEX IF NOT EXISTS idx_tasks_queue_scheduled_at ON tasks_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_queue_created_at ON tasks_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_executions_task_id ON tasks_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_executions_status ON tasks_executions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_types_module_id ON tasks_types(module_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS tasks_queue_updated_at
AFTER UPDATE ON tasks_queue
BEGIN
  UPDATE tasks_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tasks_types_updated_at
AFTER UPDATE ON tasks_types
BEGIN
  UPDATE tasks_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;