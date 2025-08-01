-- Config module schema
-- Configuration key-value storage with type support

CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Required indexes for performance
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
CREATE INDEX IF NOT EXISTS idx_config_type ON config(type);
CREATE INDEX IF NOT EXISTS idx_config_created_at ON config(created_at);

-- MCP Server Configuration Schema
-- Manages MCP server definitions and their configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
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