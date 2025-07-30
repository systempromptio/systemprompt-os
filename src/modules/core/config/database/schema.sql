-- Config module schema
-- Stores configuration key-value pairs

CREATE TABLE IF NOT EXISTS configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_configs_key ON configs(key);

-- Trigger to update updated_at on modifications
CREATE TRIGGER IF NOT EXISTS update_configs_updated_at
AFTER UPDATE ON configs
BEGIN
  UPDATE configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- MCP Server Configuration Schema
-- Manages MCP server definitions and their configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  command TEXT NOT NULL,
  args TEXT, -- JSON array of arguments
  env TEXT, -- JSON object of environment variables
  scope TEXT NOT NULL DEFAULT 'local' CHECK (scope IN ('local', 'project', 'user')),
  transport TEXT NOT NULL DEFAULT 'stdio' CHECK (transport IN ('stdio', 'sse', 'http')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'starting', 'stopping')),
  description TEXT,
  metadata TEXT, -- JSON object for additional metadata
  oauth_config TEXT, -- JSON object for OAuth 2.0 configuration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_started_at DATETIME,
  last_error TEXT
);

-- Index for faster lookups on MCP servers
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_scope ON mcp_servers(scope);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status);

-- Trigger to update updated_at on MCP server modifications
CREATE TRIGGER IF NOT EXISTS update_mcp_servers_updated_at
AFTER UPDATE ON mcp_servers
BEGIN
  UPDATE mcp_servers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;