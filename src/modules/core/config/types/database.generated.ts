// Auto-generated database types for config module
// Generated on: 2025-07-30T11:19:39.302Z
// Do not modify this file manually - it will be overwritten

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
 * Union type of all database row types in this module
 */
export type ConfigDatabaseRow = IConfigsRow;

/**
 * Database table names for this module
 */
export const CONFIG_TABLES = {
  CONFIGS: 'configs',
} as const;
