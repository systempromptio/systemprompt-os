// Auto-generated database types for config module
// Generated on: 2025-08-01T13:49:49.827Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json'
}

export enum McpServersTransport {
  STDIO = 'stdio',
  SSE = 'sse',
  HTTP = 'http'
}

export enum McpServersStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  STARTING = 'starting',
  STOPPING = 'stopping'
}

// Zod schemas for enums
export const ConfigTypeSchema = z.nativeEnum(ConfigType);
export const McpServersTransportSchema = z.nativeEnum(McpServersTransport);
export const McpServersStatusSchema = z.nativeEnum(McpServersStatus);

/**
 * Generated from database table: config
 * Do not modify this file manually - it will be overwritten
 */
export interface IConfigRow {
  id: string;
  key: string;
  value: string;
  type: ConfigType;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: mcp_servers
 * Do not modify this file manually - it will be overwritten
 */
export interface IMcpServersRow {
  id: string;
  name: string;
  command: string;
  args: string | null;
  env: string | null;
  scope: string;
  transport: McpServersTransport;
  status: McpServersStatus;
  description: string | null;
  metadata: string | null;
  oauth_config: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_started_at: string | null;
  last_error: string | null;
}

// Zod schemas for database row validation
export const ConfigRowSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  type: z.nativeEnum(ConfigType),
  description: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const McpServersRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  command: z.string(),
  args: z.string().nullable(),
  env: z.string().nullable(),
  scope: z.string(),
  transport: z.nativeEnum(McpServersTransport),
  status: z.nativeEnum(McpServersStatus),
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
export type ConfigDatabaseRow = IConfigRow | IMcpServersRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const ConfigDatabaseRowSchema = z.union([ConfigRowSchema, McpServersRowSchema]);

/**
 * Database table names for this module
 */
export const CONFIG_TABLES = {
  CONFIG: 'config',
  MCP_SERVERS: 'mcp_servers',
} as const;
