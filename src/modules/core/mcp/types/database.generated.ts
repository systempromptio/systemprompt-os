// Auto-generated database types for mcp module
// Generated on: 2025-07-28T20:02:59.642Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: mcp_contexts
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpContextsRow {
  id: string;
  name: string;
  model: string;
  description: string | null;
  config: string | null;
  max_tokens: number | null;
  temperature: number | null;
  system_prompt: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_sessions
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpSessionsRow {
  id: string;
  context_id: string;
  status: string;
  metadata: string | null;
  started_at: string | null;
  ended_at: string | null;
}

/**
 * Generated from database table: mcp_messages
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpMessagesRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  metadata: string | null;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type McpDatabaseRow = IMcpContextsRow | IMcpSessionsRow | IMcpMessagesRow;

/**
 * Database table names for this module
 */
export const MCP_TABLES = {
  MCPCONTEXTS: 'mcp_contexts',
  MCPSESSIONS: 'mcp_sessions',
  MCPMESSAGES: 'mcp_messages',
} as const;
