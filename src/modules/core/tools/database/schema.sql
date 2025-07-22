-- MCP Tools Schema
CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    input_schema TEXT NOT NULL, -- JSON schema for tool parameters
    handler_path TEXT NOT NULL, -- Path to the tool handler implementation
    module_name TEXT NOT NULL, -- Module that provides this tool
    scope TEXT NOT NULL CHECK (scope IN ('remote', 'local', 'all')),
    enabled INTEGER NOT NULL DEFAULT 1, -- Boolean: 1 = enabled, 0 = disabled
    metadata TEXT, -- JSON for additional tool metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_scope ON tools(scope);
CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(enabled);
CREATE INDEX IF NOT EXISTS idx_tools_module ON tools(module_name);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_tools_scope_enabled ON tools(scope, enabled);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_tools_timestamp 
AFTER UPDATE ON tools
BEGIN
    UPDATE tools SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;