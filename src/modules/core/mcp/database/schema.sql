-- MCP (Model Context Protocol) module schema
-- Manages AI model contexts, sessions, and interactions

CREATE TABLE IF NOT EXISTS mcp_contexts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    description TEXT,
    max_tokens INTEGER DEFAULT 4096,
    temperature REAL DEFAULT 0.7,
    top_p REAL,
    frequency_penalty REAL,
    presence_penalty REAL,
    stop_sequences TEXT, -- Comma-separated stop sequences
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mcp_sessions (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
    session_name TEXT,
    user_id TEXT,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (context_id) REFERENCES mcp_contexts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mcp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    token_count INTEGER,
    cost REAL,
    model_used TEXT,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES mcp_sessions(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_contexts_name ON mcp_contexts(name);
CREATE INDEX IF NOT EXISTS idx_mcp_contexts_model ON mcp_contexts(model);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_context_id ON mcp_sessions(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_status ON mcp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_session_id ON mcp_messages(session_id);

-- MCP Content Tables (Resources, Prompts, Templates)
-- This schema defines the storage for MCP content discovered in modules

-- MCP Resources table
CREATE TABLE IF NOT EXISTS mcp_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    mime_type TEXT NOT NULL DEFAULT 'text/plain',
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'blob')),
    content TEXT, -- For text content
    blob_content BLOB, -- For binary content
    size INTEGER,
    module_name TEXT NOT NULL,
    file_path TEXT,
    category TEXT,
    tags TEXT, -- Comma-separated tags
    author TEXT,
    version TEXT,
    checksum TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_synced_at DATETIME
);

-- MCP Prompts table
CREATE TABLE IF NOT EXISTS mcp_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    module_name TEXT NOT NULL,
    file_path TEXT,
    category TEXT,
    tags TEXT, -- Comma-separated tags
    author TEXT,
    version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_synced_at DATETIME
);

-- MCP Prompt Messages table - normalized message storage
CREATE TABLE IF NOT EXISTS mcp_prompt_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    message_order INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES mcp_prompts(id) ON DELETE CASCADE
);

-- MCP Prompt Arguments table - normalized argument storage
CREATE TABLE IF NOT EXISTS mcp_prompt_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    argument_name TEXT NOT NULL,
    argument_description TEXT,
    is_required BOOLEAN DEFAULT 0,
    argument_order INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES mcp_prompts(id) ON DELETE CASCADE
);

-- MCP Resource Templates table
CREATE TABLE IF NOT EXISTS mcp_resource_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri_template TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    mime_type TEXT,
    module_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for MCP content
CREATE INDEX IF NOT EXISTS idx_mcp_resources_module_name ON mcp_resources(module_name);
CREATE INDEX IF NOT EXISTS idx_mcp_resources_uri ON mcp_resources(uri);
CREATE INDEX IF NOT EXISTS idx_mcp_resources_category ON mcp_resources(category);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_module_name ON mcp_prompts(module_name);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_name ON mcp_prompts(name);
CREATE INDEX IF NOT EXISTS idx_mcp_prompts_category ON mcp_prompts(category);
CREATE INDEX IF NOT EXISTS idx_mcp_prompt_messages_prompt_id ON mcp_prompt_messages(prompt_id);
CREATE INDEX IF NOT EXISTS idx_mcp_prompt_arguments_prompt_id ON mcp_prompt_arguments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_mcp_resource_templates_module_name ON mcp_resource_templates(module_name);