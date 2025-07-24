-- MCP (Model Context Protocol) module schema
-- Manages AI model contexts, sessions, and interactions

CREATE TABLE IF NOT EXISTS mcp_contexts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    description TEXT,
    config TEXT, -- JSON configuration
    max_tokens INTEGER DEFAULT 4096,
    temperature REAL DEFAULT 0.7,
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mcp_sessions (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
    metadata TEXT, -- JSON metadata
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (context_id) REFERENCES mcp_contexts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mcp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES mcp_sessions(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_contexts_name ON mcp_contexts(name);
CREATE INDEX IF NOT EXISTS idx_mcp_contexts_model ON mcp_contexts(model);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_context_id ON mcp_sessions(context_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_status ON mcp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_session_id ON mcp_messages(session_id);