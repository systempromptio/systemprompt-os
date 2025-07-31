// Auto-generated database types for logger module
// Generated on: 2025-07-31T13:04:44.062Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for database row validation
export const SystemLogsRowSchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  level: z.string(),
  source: z.string(),
  category: z.string().nullable(),
  message: z.string(),
  args: z.string(),
  created_at: z.string().datetime().nullable(),
});

export const AccessLogsRowSchema = z.object({
  id: z.number(),
  method: z.string().nullable(),
  url: z.string().url().nullable(),
  status_code: z.number().nullable(),
  response_time_ms: z.number().nullable(),
  user_agent: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_id: z.string().nullable(),
  timestamp: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type LoggerDatabaseRow = ISystemLogsRow | IAccessLogsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const LoggerDatabaseRowSchema = z.union([SystemLogsRowSchema, AccessLogsRowSchema]);

/**
 * Database table names for this module
 */
export const LOGGER_TABLES = {
  SYSTEM_LOGS: 'system_logs',
  ACCESS_LOGS: 'access_logs',
} as const;
