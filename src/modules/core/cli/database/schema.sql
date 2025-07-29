-- CLI Commands Registry
CREATE TABLE IF NOT EXISTS cli_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_name TEXT NOT NULL,
  command_name TEXT NOT NULL,
  command_path TEXT NOT NULL, -- Full command path like "auth:generatekey"
  description TEXT,
  executor_path TEXT NOT NULL, -- Path to the built command file
  active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(command_path)
);

-- CLI Command Options (normalized structure instead of JSON)
CREATE TABLE IF NOT EXISTS cli_command_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id INTEGER NOT NULL,
  option_name TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('string', 'boolean', 'number', 'array')),
  description TEXT NOT NULL,
  alias TEXT,
  default_value TEXT,
  required BOOLEAN DEFAULT 0,
  choices TEXT, -- Comma-separated choices if applicable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (command_id) REFERENCES cli_commands(id) ON DELETE CASCADE,
  UNIQUE(command_id, option_name)
);

-- CLI Command Aliases (normalized structure instead of JSON)
CREATE TABLE IF NOT EXISTS cli_command_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (command_id) REFERENCES cli_commands(id) ON DELETE CASCADE,
  UNIQUE(command_id, alias)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cli_commands_module_name ON cli_commands(module_name);
CREATE INDEX IF NOT EXISTS idx_cli_commands_active ON cli_commands(active);
CREATE INDEX IF NOT EXISTS idx_cli_commands_command_path ON cli_commands(command_path);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_cli_commands_timestamp 
AFTER UPDATE ON cli_commands
BEGIN
  UPDATE cli_commands SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;