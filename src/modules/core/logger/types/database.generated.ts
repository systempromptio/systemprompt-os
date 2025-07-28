// Auto-generated database types for logger module
// Generated on: 2025-07-28T19:59:56.312Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: system_logs
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemLogsRow {
  id: number;
  timestamp: string;
  level: string;
  source: string;
  category: string | null;
  message: string;
  args: string;
  created_at: string | null;
}

/**
 * Generated from database table: access_logs
 * Do not modify this file manually - it will be overwritten
 */
export interface IAccessLogsRow {
  id: number;
  method: string | null;
  url: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  user_agent: string | null;
  ip_address: string | null;
  user_id: string | null;
  timestamp: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type LoggerDatabaseRow = ISystemLogsRow | IAccessLogsRow;

/**
 * Database table names for this module
 */
export const LOGGER_TABLES = {
  SYSTEMLOGS: 'system_logs',
  ACCESSLOGS: 'access_logs',
} as const;
