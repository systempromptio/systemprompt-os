// Auto-generated database types for config module
// Generated on: 2025-07-31T11:41:32.422Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum McpServersScope {
  LOCAL = 'local',
  PROJECT = 'project',
  USER = 'user'
}

// Zod schemas for enums
export const McpServersScopeSchema = z.nativeEnum(McpServersScope);

/**
 * Generated from database table: configs
 * Do not modify this file manually - it will be overwritten
 */
export interface IConfigsRow {
  id: number;
  key: string;
  value: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_servers
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpServersRow {
  id: number;
  name: string;
  command: string;
  args: string | null;
  env: string | null;
  scope: McpServersScope;
  transport: string;
  status: string;
  description: string | null;
  metadata: string | null;
  oauth_config: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_started_at: string | null;
  last_error: string | null;
}

// Zod schemas for database row validation
export const ConfigsRowSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string(),
  description: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpServersRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  command: z.string(),
  args: z.string().nullable(),
  env: z.string().nullable(),
  scope: z.nativeEnum(McpServersScope),
  transport: z.string(),
  status: z.string(),
  description: z.string().nullable(),
  metadata: z.string().nullable(),
  oauth_config: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  last_started_at: z.string().datetime().nullable(),
  last_error: z.string().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type ConfigDatabaseRow = IConfigsRow | IMcpServersRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const ConfigDatabaseRowSchema = z.union([ConfigsRowSchema, McpServersRowSchema]);

/**
 * Database table names for this module
 */
export const CONFIG_TABLES = {
  CONFIGS: 'configs',
  MCP_SERVERS: 'mcp_servers',
} as const;
