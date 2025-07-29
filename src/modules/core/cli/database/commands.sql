-- Module CLI commands table
CREATE TABLE IF NOT EXISTS module_cli_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  command_name TEXT NOT NULL,
  description TEXT,
  handler_path TEXT, -- Path to the command handler
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE(module_id, command_name)
);

-- Module CLI command options table
CREATE TABLE IF NOT EXISTS module_cli_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id INTEGER NOT NULL,
  option_name TEXT NOT NULL,
  option_type TEXT CHECK(option_type IN ('string', 'number', 'boolean')) NOT NULL,
  description TEXT,
  alias TEXT,
  required BOOLEAN DEFAULT 0,
  default_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (command_id) REFERENCES module_cli_commands(id) ON DELETE CASCADE,
  UNIQUE(command_id, option_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_cli_commands_module_id ON module_cli_commands(module_id);
CREATE INDEX IF NOT EXISTS idx_module_cli_options_command_id ON module_cli_options(command_id);