-- MCP Resources Schema
CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    mime_type TEXT NOT NULL DEFAULT 'text/plain',
    content_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'blob', or 'template'
    content TEXT NOT NULL, -- Actual content or template
    metadata TEXT, -- JSON object for additional metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by URI
CREATE INDEX IF NOT EXISTS idx_resources_uri ON resources(uri);

-- Index for content type filtering
CREATE INDEX IF NOT EXISTS idx_resources_content_type ON resources(content_type);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_resources_timestamp 
AFTER UPDATE ON resources
BEGIN
    UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;