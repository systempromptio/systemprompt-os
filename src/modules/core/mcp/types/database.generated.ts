// Auto-generated database types for mcp module
// Generated on: 2025-08-02T16:08:07.375Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum McpContextPermissionsPrincipalType {
  USER = 'user',
  ROLE = 'role'
}

// Zod schemas for enums
export const McpContextPermissionsPrincipalTypeSchema = z.nativeEnum(McpContextPermissionsPrincipalType);

/**
 * Generated from database table: mcp_contexts
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpContextsRow {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  server_config: string;
  auth_config: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_tools
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpToolsRow {
  id: string;
  context_id: string;
  name: string;
  description: string | null;
  input_schema: string;
  annotations: string | null;
  required_permission: string | null;
  required_role: string | null;
  handler_type: string;
  handler_config: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_resources
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpResourcesRow {
  id: string;
  context_id: string;
  uri: string;
  name: string;
  description: string | null;
  mime_type: string | null;
  annotations: string | null;
  content_type: string;
  content: string | null;
  required_permission: string | null;
  required_role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_prompts
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpPromptsRow {
  id: string;
  context_id: string;
  name: string;
  description: string | null;
  arguments: string | null;
  annotations: string | null;
  template: string;
  required_permission: string | null;
  required_role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_context_permissions
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpContextPermissionsRow {
  id: string;
  context_id: string;
  principal_type: McpContextPermissionsPrincipalType;
  principal_id: string;
  permission: string;
  created_at: string | null;
}

// Zod schemas for database row validation
export const McpContextsRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string().nullable(),
  server_config: z.string(),
  auth_config: z.string().nullable(),
  is_active: z.boolean().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpToolsRowSchema = z.object({
  id: z.string(),
  context_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  input_schema: z.string(),
  annotations: z.string().nullable(),
  required_permission: z.string().nullable(),
  required_role: z.string().nullable(),
  handler_type: z.string(),
  handler_config: z.string(),
  is_active: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpResourcesRowSchema = z.object({
  id: z.string(),
  context_id: z.string(),
  uri: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  mime_type: z.string().nullable(),
  annotations: z.string().nullable(),
  content_type: z.string(),
  content: z.string().nullable(),
  required_permission: z.string().nullable(),
  required_role: z.string().nullable(),
  is_active: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpPromptsRowSchema = z.object({
  id: z.string(),
  context_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  arguments: z.string().nullable(),
  annotations: z.string().nullable(),
  template: z.string(),
  required_permission: z.string().nullable(),
  required_role: z.string().nullable(),
  is_active: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpContextPermissionsRowSchema = z.object({
  id: z.string(),
  context_id: z.string(),
  principal_type: z.nativeEnum(McpContextPermissionsPrincipalType),
  principal_id: z.string(),
  permission: z.string(),
  created_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type McpDatabaseRow = IMcpContextsRow | IMcpToolsRow | IMcpResourcesRow | IMcpPromptsRow | IMcpContextPermissionsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const McpDatabaseRowSchema = z.union([McpContextsRowSchema, McpToolsRowSchema, McpResourcesRowSchema, McpPromptsRowSchema, McpContextPermissionsRowSchema]);

/**
 * Database table names for this module
 */
export const MCP_TABLES = {
  MCP_CONTEXTS: 'mcp_contexts',
  MCP_TOOLS: 'mcp_tools',
  MCP_RESOURCES: 'mcp_resources',
  MCP_PROMPTS: 'mcp_prompts',
  MCP_CONTEXT_PERMISSIONS: 'mcp_context_permissions',
} as const;
