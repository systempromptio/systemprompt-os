// Auto-generated database types for dev module
// Generated on: 2025-07-28T20:02:59.642Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: dev_profiles
 * Do not modify this file manually - it will be overwritten
 */
export interface IDevProfilesRow {
  id: number;
  name: string;
  config: string | null;
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
  metadata: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type DevDatabaseRow = IDevProfilesRow | IDevSessionsRow;

/**
 * Database table names for this module
 */
export const DEV_TABLES = {
  DEVPROFILES: 'dev_profiles',
  DEVSESSIONS: 'dev_sessions',
} as const;
