-- Rollback migration: Remove MCP Resources and Prompts tables

-- Drop triggers
DROP TRIGGER IF EXISTS update_mcp_resources_timestamp;
DROP TRIGGER IF EXISTS update_mcp_prompts_timestamp;
DROP TRIGGER IF EXISTS update_mcp_resource_templates_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_mcp_resources_module_name;
DROP INDEX IF EXISTS idx_mcp_resources_uri;
DROP INDEX IF EXISTS idx_mcp_resources_mime_type;
DROP INDEX IF EXISTS idx_mcp_prompts_module_name;
DROP INDEX IF EXISTS idx_mcp_prompts_name;
DROP INDEX IF EXISTS idx_mcp_resource_templates_module_name;

-- Drop tables
DROP TABLE IF EXISTS mcp_resource_templates;
DROP TABLE IF EXISTS mcp_prompts;
DROP TABLE IF EXISTS mcp_resources;