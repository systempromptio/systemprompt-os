// Auto-generated database types for system module
// Generated on: 2025-07-28T20:02:59.640Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: system_config
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemConfigRow {
  key: string;
  value: string;
  type: string;
  description: string | null;
  is_secret: boolean | null;
  is_readonly: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: system_modules
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemModulesRow {
  name: string;
  version: string;
  status: string;
  enabled: boolean | null;
  metadata: string | null;
  initialized_at: string | null;
  last_health_check: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: system_events
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemEventsRow {
  id: number;
  event_type: string;
  source: string;
  severity: string;
  message: string;
  metadata: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: system_maintenance
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemMaintenanceRow {
  id: string;
  type: string;
  reason: string;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  notes: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type SystemDatabaseRow = ISystemConfigRow | ISystemModulesRow | ISystemEventsRow | ISystemMaintenanceRow;

/**
 * Database table names for this module
 */
export const SYSTEM_TABLES = {
  SYSTEMCONFIG: 'system_config',
  SYSTEMMODULES: 'system_modules',
  SYSTEMEVENTS: 'system_events',
  SYSTEMMAINTENANCE: 'system_maintenance',
} as const;
