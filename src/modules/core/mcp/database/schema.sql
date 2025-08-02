-- MCP Module Database Schema
-- Manages MCP contexts (servers), tools, resources, prompts, and permissions

-- MCP Contexts (Servers)
CREATE TABLE IF NOT EXISTS mcp_contexts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  -- Server configuration
  server_config JSON NOT NULL, -- Full MCP Server configuration
  -- Authentication configuration (for MCP SDK middleware)
  auth_config JSON, -- {type: 'bearer' | 'client', config: {...}}
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP Tools (SDK-compatible)
CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSON NOT NULL, -- JSON Schema for tool input
  annotations JSON, -- Additional tool metadata
  -- Permissions
  required_permission TEXT, -- Permission needed to use this tool
  required_role TEXT, -- Role needed to use this tool
  -- Handler configuration
  handler_type TEXT NOT NULL CHECK(handler_type IN ('function', 'http', 'command')),
  handler_config JSON NOT NULL, -- Configuration for the handler
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, name)
);

-- MCP Resources (SDK-compatible)
CREATE TABLE IF NOT EXISTS mcp_resources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mime_type TEXT DEFAULT 'text/plain',
  annotations JSON, -- Additional resource metadata
  -- Resource content or handler
  content_type TEXT NOT NULL CHECK(content_type IN ('static', 'dynamic')),
  content JSON, -- Static content or handler configuration
  -- Permissions
  required_permission TEXT,
  required_role TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, uri)
);

-- MCP Prompts (SDK-compatible)
CREATE TABLE IF NOT EXISTS mcp_prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  arguments JSON, -- Array of argument definitions
  annotations JSON, -- Additional prompt metadata
  -- Prompt template
  template TEXT NOT NULL,
  -- Permissions
  required_permission TEXT,
  required_role TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, name)
);

-- MCP Context Permissions
CREATE TABLE IF NOT EXISTS mcp_context_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK(principal_type IN ('user', 'role')),
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, principal_type, principal_id, permission)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_tools_context ON mcp_tools(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_resources_context ON mcp_resources(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_context ON mcp_prompts(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_permissions_context ON mcp_context_permissions(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_permissions_principal ON mcp_context_permissions(principal_type, principal_id);