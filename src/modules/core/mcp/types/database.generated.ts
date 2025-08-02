// Auto-generated database types for mcp module
// Generated on: 2025-08-02T11:28:23.699Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for enums
export const McpSessionsStatusSchema = z.nativeEnum(McpSessionsStatus);
export const McpMessagesRoleSchema = z.nativeEnum(McpMessagesRole);
export const McpResourcesContentTypeSchema = z.nativeEnum(McpResourcesContentType);
export const McpPromptMessagesRoleSchema = z.nativeEnum(McpPromptMessagesRole);

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

// Zod schemas for database row validation
export const McpContextsRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  description: z.string().nullable(),
  max_tokens: z.number().nullable(),
  temperature: z.number().nullable(),
  top_p: z.number().nullable(),
  frequency_penalty: z.number().nullable(),
  presence_penalty: z.number().nullable(),
  stop_sequences: z.string().nullable(),
  system_prompt: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpSessionsRowSchema = z.object({
  id: z.string(),
  context_id: z.string(),
  status: z.nativeEnum(McpSessionsStatus),
  session_name: z.string().nullable(),
  user_id: z.string().nullable(),
  total_tokens: z.number().nullable(),
  total_cost: z.number().nullable(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
});

export const McpMessagesRowSchema = z.object({
  id: z.number(),
  session_id: z.string(),
  role: z.nativeEnum(McpMessagesRole),
  content: z.string(),
  token_count: z.number().nullable(),
  cost: z.number().nullable(),
  model_used: z.string().nullable(),
  processing_time_ms: z.number().nullable(),
  created_at: z.string().datetime().nullable(),
});

export const McpResourcesRowSchema = z.object({
  id: z.number(),
  uri: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  mime_type: z.string(),
  content_type: z.nativeEnum(McpResourcesContentType),
  content: z.string().nullable(),
  blob_content: z.string().nullable(),
  size: z.number().nullable(),
  module_name: z.string(),
  file_path: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.string().nullable(),
  author: z.string().nullable(),
  version: z.string().nullable(),
  checksum: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  last_synced_at: z.string().datetime().nullable(),
});

export const McpPromptsRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  module_name: z.string(),
  file_path: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.string().nullable(),
  author: z.string().nullable(),
  version: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  last_synced_at: z.string().datetime().nullable(),
});

export const McpPromptMessagesRowSchema = z.object({
  id: z.number(),
  prompt_id: z.number(),
  role: z.nativeEnum(McpPromptMessagesRole),
  content: z.string(),
  message_order: z.number(),
  created_at: z.string().datetime().nullable(),
});

export const McpPromptArgumentsRowSchema = z.object({
  id: z.number(),
  prompt_id: z.number(),
  argument_name: z.string(),
  argument_description: z.string().nullable(),
  is_required: z.boolean().nullable(),
  argument_order: z.number(),
  created_at: z.string().datetime().nullable(),
});

export const McpResourceTemplatesRowSchema = z.object({
  id: z.number(),
  uri_template: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  mime_type: z.string().nullable(),
  module_name: z.string(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type McpDatabaseRow = IMcpContextsRow | IMcpSessionsRow | IMcpMessagesRow | IMcpResourcesRow | IMcpPromptsRow | IMcpPromptMessagesRow | IMcpPromptArgumentsRow | IMcpResourceTemplatesRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const McpDatabaseRowSchema = z.union([McpContextsRowSchema, McpSessionsRowSchema, McpMessagesRowSchema, McpResourcesRowSchema, McpPromptsRowSchema, McpPromptMessagesRowSchema, McpPromptArgumentsRowSchema, McpResourceTemplatesRowSchema]);

/**
 * Database table names for this module
 */
export const MCP_TABLES = {
  MCP_CONTEXTS: 'mcp_contexts',
  MCP_SESSIONS: 'mcp_sessions',
  MCP_MESSAGES: 'mcp_messages',
  MCP_RESOURCES: 'mcp_resources',
  MCP_PROMPTS: 'mcp_prompts',
  MCP_PROMPT_MESSAGES: 'mcp_prompt_messages',
  MCP_PROMPT_ARGUMENTS: 'mcp_prompt_arguments',
  MCP_RESOURCE_TEMPLATES: 'mcp_resource_templates',
} as const;
