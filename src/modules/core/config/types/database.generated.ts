// Auto-generated database types for config module
// Generated on: 2025-07-30T14:04:58.742Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum McpServersScope {
  LOCAL = 'local',
  PROJECT = 'project',
  USER = 'user'
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

/**
 * Union type of all database row types in this module
 */
export type ConfigDatabaseRow = IConfigsRow | IMcpServersRow;

/**
 * Database table names for this module
 */
export const CONFIG_TABLES = {
  CONFIGS: 'configs',
  MCPSERVERS: 'mcp_servers',
} as const;
