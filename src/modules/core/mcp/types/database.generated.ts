// Auto-generated database types for mcp module
// Generated on: 2025-07-30T07:52:14.636Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum McpSessionsStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum McpMessagesRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant'
}

export enum McpResourcesContentType {
  TEXT = 'text',
  BLOB = 'blob'
}

export enum McpPromptMessagesRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant'
}

/**
 * Generated from database table: mcp_contexts
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpContextsRow {
  id: string;
  name: string;
  model: string;
  description: string | null;
  max_tokens: number | null;
  temperature: number | null;
  top_p: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  stop_sequences: string | null;
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
  status: McpSessionsStatus;
  session_name: string | null;
  user_id: string | null;
  total_tokens: number | null;
  total_cost: number | null;
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
  role: McpMessagesRole;
  content: string;
  token_count: number | null;
  cost: number | null;
  model_used: string | null;
  processing_time_ms: number | null;
  created_at: string | null;
}

/**
 * Generated from database table: mcp_resources
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpResourcesRow {
  id: number;
  uri: string;
  name: string;
  description: string | null;
  mime_type: string;
  content_type: McpResourcesContentType;
  content: string | null;
  blob_content: string | null;
  size: number | null;
  module_name: string;
  file_path: string | null;
  category: string | null;
  tags: string | null;
  author: string | null;
  version: string | null;
  checksum: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
}

/**
 * Generated from database table: mcp_prompts
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpPromptsRow {
  id: number;
  name: string;
  description: string | null;
  module_name: string;
  file_path: string | null;
  category: string | null;
  tags: string | null;
  author: string | null;
  version: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
}

/**
 * Generated from database table: mcp_prompt_messages
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpPromptMessagesRow {
  id: number;
  prompt_id: number;
  role: McpPromptMessagesRole;
  content: string;
  message_order: number;
  created_at: string | null;
}

/**
 * Generated from database table: mcp_prompt_arguments
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpPromptArgumentsRow {
  id: number;
  prompt_id: number;
  argument_name: string;
  argument_description: string | null;
  is_required: boolean | null;
  argument_order: number;
  created_at: string | null;
}

/**
 * Generated from database table: mcp_resource_templates
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpResourceTemplatesRow {
  id: number;
  uri_template: string;
  name: string;
  description: string | null;
  mime_type: string | null;
  module_name: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type McpDatabaseRow = IMcpContextsRow | IMcpSessionsRow | IMcpMessagesRow | IMcpResourcesRow | IMcpPromptsRow | IMcpPromptMessagesRow | IMcpPromptArgumentsRow | IMcpResourceTemplatesRow;

/**
 * Database table names for this module
 */
export const MCP_TABLES = {
  MCPCONTEXTS: 'mcp_contexts',
  MCPSESSIONS: 'mcp_sessions',
  MCPMESSAGES: 'mcp_messages',
  MCPRESOURCES: 'mcp_resources',
  MCPPROMPTS: 'mcp_prompts',
  MCPPROMPTMESSAGES: 'mcp_prompt_messages',
  MCPPROMPTARGUMENTS: 'mcp_prompt_arguments',
  MCPRESOURCETEMPLATES: 'mcp_resource_templates',
} as const;
