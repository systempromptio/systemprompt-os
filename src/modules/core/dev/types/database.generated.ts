// Auto-generated database types for dev module
// Generated on: 2025-07-31T11:41:31.665Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

/**
 * Generated from database table: dev_profiles
 * Do not modify this file manually - it will be overwritten
 */
export interface IDevProfilesRow {
  id: number;
  name: string;
  description: string | null;
  config_enabled: number | null;
  config_auto_save: number | null;
  config_debug_mode: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: dev_sessions
 * Do not modify this file manually - it will be overwritten
 */
export interface IDevSessionsRow {
  id: number;
  profile_id: number | null;
  type: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  exit_code: number | null;
  output_lines: number | null;
  error_count: number | null;
}

// Zod schemas for database row validation
export const DevProfilesRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  config_enabled: z.number().nullable(),
  config_auto_save: z.number().nullable(),
  config_debug_mode: z.number().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const DevSessionsRowSchema = z.object({
  id: z.number(),
  profile_id: z.number().nullable(),
  type: z.string(),
  status: z.string(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  exit_code: z.number().nullable(),
  output_lines: z.number().nullable(),
  error_count: z.number().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type DevDatabaseRow = IDevProfilesRow | IDevSessionsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const DevDatabaseRowSchema = z.union([DevProfilesRowSchema, DevSessionsRowSchema]);

/**
 * Database table names for this module
 */
export const DEV_TABLES = {
  DEV_PROFILES: 'dev_profiles',
  DEV_SESSIONS: 'dev_sessions',
} as const;
