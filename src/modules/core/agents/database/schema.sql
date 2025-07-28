-- Agents module schema
-- Manages autonomous agents and their tasks

-- Agents table
-- Stores agent definitions with their configurations
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('worker', 'monitor', 'coordinator')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'active', 'stopped', 'error')),
  config TEXT DEFAULT '{}', -- JSON configuration
  capabilities TEXT DEFAULT '[]', -- JSON array of capabilities
  tools TEXT DEFAULT '[]', -- JSON array of tools the agent can use
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP
);

-- Agent tasks table
-- Stores tasks assigned to agents
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
  payload TEXT NOT NULL, -- JSON payload
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Agent logs table
-- Stores logs for agent activities
CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Agent metrics table
-- Stores performance metrics for agents
CREATE TABLE IF NOT EXISTS agent_metrics (
  agent_id TEXT NOT NULL,
  cpu_usage REAL DEFAULT 0,
  memory_usage REAL DEFAULT 0,
  active_tasks INTEGER DEFAULT 0,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON agent_logs(level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_agents_timestamp 
AFTER UPDATE ON agents
BEGIN
  UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;