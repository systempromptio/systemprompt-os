-- Migration: Add MCP Resources and Prompts tables
-- This migration adds support for Module Context Protocol (MCP) resources and prompts
-- that can be provided by modules via markdown files

-- MCP Resources table
-- Stores resources that modules provide, supporting various content types
CREATE TABLE IF NOT EXISTS mcp_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL UNIQUE,           -- e.g., "module://auth/resources/api-docs"
  name TEXT NOT NULL,                 -- Human-readable name
  description TEXT,                   -- Resource description
  mime_type TEXT DEFAULT 'text/plain', -- MIME type (text/plain, application/json, image/png, audio/mp3, etc.)
  content_type TEXT NOT NULL CHECK(content_type IN ('text', 'blob')), -- How content is stored
  content TEXT,                       -- Text content (for text resources)
  blob_content BLOB,                  -- Binary content (for images, audio, etc.)
  size INTEGER,                       -- Size in bytes
  module_name TEXT NOT NULL,          -- Source module
  file_path TEXT,                     -- Original file path relative to module
  metadata TEXT,                      -- JSON: Additional metadata (tags, author, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP,           -- When last synced from file
  FOREIGN KEY (module_name) REFERENCES modules(name) ON DELETE CASCADE
);

-- MCP Prompts table
-- Stores prompts that modules provide via markdown files
CREATE TABLE IF NOT EXISTS mcp_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,          -- Unique prompt identifier
  description TEXT,                   -- Prompt description
  messages TEXT NOT NULL,             -- JSON: Array of {role, content} objects
  arguments TEXT,                     -- JSON: Array of {name, description, required}
  module_name TEXT NOT NULL,          -- Source module
  file_path TEXT,                     -- Original markdown file path relative to module
  metadata TEXT,                      -- JSON: Category, tags, author, version
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP,           -- When last synced from file
  FOREIGN KEY (module_name) REFERENCES modules(name) ON DELETE CASCADE
);

-- MCP Resource Templates table
-- For dynamic resources with URI templates
CREATE TABLE IF NOT EXISTS mcp_resource_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri_template TEXT NOT NULL UNIQUE,  -- e.g., "users://{userId}/profile"
  name TEXT NOT NULL,                 -- Human-readable name
  description TEXT,                   -- Template description
  mime_type TEXT,                     -- Default MIME type for template
  module_name TEXT NOT NULL,          -- Source module
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_name) REFERENCES modules(name) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_resources_module_name ON mcp_resources(module_name);
CREATE INDEX IF NOT EXISTS idx_mcp_resources_uri ON mcp_resources(uri);
CREATE INDEX IF NOT EXISTS idx_mcp_resources_mime_type ON mcp_resources(mime_type);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_module_name ON mcp_prompts(module_name);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_name ON mcp_prompts(name);
CREATE INDEX IF NOT EXISTS idx_mcp_resource_templates_module_name ON mcp_resource_templates(module_name);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_mcp_resources_timestamp 
AFTER UPDATE ON mcp_resources
BEGIN
  UPDATE mcp_resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_mcp_prompts_timestamp 
AFTER UPDATE ON mcp_prompts
BEGIN
  UPDATE mcp_prompts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_mcp_resource_templates_timestamp 
AFTER UPDATE ON mcp_resource_templates
BEGIN
  UPDATE mcp_resource_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;