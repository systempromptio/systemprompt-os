// Auto-generated database types for system module
// Generated on: 2025-07-30T22:16:41.625Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum SystemConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean'
}

export enum SystemModulesStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

export enum SystemEventsSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum SystemMaintenanceType {
  SCHEDULED = 'scheduled',
  EMERGENCY = 'emergency'
}

/**
 * Generated from database table: system_config
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemConfigRow {
  key: string;
  value: string;
  type: SystemConfigType;
  description: string | null;
  is_secret: number | null;
  is_readonly: number | null;
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
  status: SystemModulesStatus;
  enabled: number | null;
  initialized_at: string | null;
  last_health_check: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: system_module_metadata
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemModuleMetadataRow {
  module_name: string;
  metadata_key: string;
  metadata_value: string;
  created_at: string | null;
}

/**
 * Generated from database table: system_events
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemEventsRow {
  id: number;
  event_type: string;
  source: string;
  severity: SystemEventsSeverity;
  message: string;
  created_at: string | null;
}

/**
 * Generated from database table: system_event_metadata
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemEventMetadataRow {
  event_id: number;
  metadata_key: string;
  metadata_value: string;
}

/**
 * Generated from database table: system_maintenance
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemMaintenanceRow {
  id: string;
  type: SystemMaintenanceType;
  reason: string;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  notes: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type SystemDatabaseRow = ISystemConfigRow | ISystemModulesRow | ISystemModuleMetadataRow | ISystemEventsRow | ISystemEventMetadataRow | ISystemMaintenanceRow;

/**
 * Database table names for this module
 */
export const SYSTEM_TABLES = {
  SYSTEMCONFIG: 'system_config',
  SYSTEMMODULES: 'system_modules',
  SYSTEMMODULEMETADATA: 'system_module_metadata',
  SYSTEMEVENTS: 'system_events',
  SYSTEMEVENTMETADATA: 'system_event_metadata',
  SYSTEMMAINTENANCE: 'system_maintenance',
} as const;
