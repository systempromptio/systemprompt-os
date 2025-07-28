-- Tasks module database schema
-- Provides task management for SystemPrompt OS

-- Task table
CREATE TABLE IF NOT EXISTS task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(100) NOT NULL,
  module_id VARCHAR(100) NOT NULL,
  instructions JSON,
  priority INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'stopped')),
  retry_count INTEGER DEFAULT 0,
  max_executions INTEGER DEFAULT 3,
  max_time INTEGER, -- Max execution time in seconds (optional)
  result TEXT, -- Task execution result (optional)
  scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  metadata JSON
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);
CREATE INDEX IF NOT EXISTS idx_task_type ON task(type);
CREATE INDEX IF NOT EXISTS idx_task_module_id ON task(module_id);
CREATE INDEX IF NOT EXISTS idx_task_scheduled_at ON task(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS task_updated_at
AFTER UPDATE ON task
BEGIN
  UPDATE task SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;