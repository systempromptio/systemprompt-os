-- CLI Module Database Schema

-- CLI Commands Registry
CREATE TABLE IF NOT EXISTS cli_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_name TEXT NOT NULL,
  command_name TEXT NOT NULL,
  command_path TEXT NOT NULL, -- Full command path like "auth:generatekey"
  description TEXT,
  executor_path TEXT NOT NULL, -- Path to the built command file
  options TEXT, -- JSON array of command options
  aliases TEXT, -- JSON array of command aliases
  active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(command_path)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cli_commands_module_name ON cli_commands(module_name);
CREATE INDEX IF NOT EXISTS idx_cli_commands_active ON cli_commands(active);
CREATE INDEX IF NOT EXISTS idx_cli_commands_command_path ON cli_commands(command_path);

-- Trigger to update timestamp
CREATE TRIGGER IF NOT EXISTS update_cli_commands_timestamp 
AFTER UPDATE ON cli_commands
BEGIN
  UPDATE cli_commands SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Command execution history (optional, for debugging/auditing)
CREATE TABLE IF NOT EXISTS cli_command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_path TEXT NOT NULL,
  arguments TEXT, -- JSON of arguments passed
  exit_code INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cli_history_command ON cli_command_history(command_path);
CREATE INDEX IF NOT EXISTS idx_cli_history_executed ON cli_command_history(executed_at);