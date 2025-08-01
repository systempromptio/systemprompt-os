// Auto-generated database types for system module
// Generated on: 2025-08-01T13:49:53.117Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for enums
export const SystemConfigTypeSchema = z.nativeEnum(SystemConfigType);
export const SystemModulesStatusSchema = z.nativeEnum(SystemModulesStatus);
export const SystemEventsSeveritySchema = z.nativeEnum(SystemEventsSeverity);
export const SystemMaintenanceTypeSchema = z.nativeEnum(SystemMaintenanceType);

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

// Zod schemas for database row validation
export const SystemConfigRowSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.nativeEnum(SystemConfigType),
  description: z.string().nullable(),
  is_secret: z.number().nullable(),
  is_readonly: z.number().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const SystemModulesRowSchema = z.object({
  name: z.string(),
  version: z.string(),
  status: z.nativeEnum(SystemModulesStatus),
  enabled: z.number().nullable(),
  initialized_at: z.string().nullable(),
  last_health_check: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const SystemModuleMetadataRowSchema = z.object({
  module_name: z.string(),
  metadata_key: z.string(),
  metadata_value: z.string(),
  created_at: z.string().nullable(),
});

export const SystemEventsRowSchema = z.object({
  id: z.number(),
  event_type: z.string(),
  source: z.string(),
  severity: z.nativeEnum(SystemEventsSeverity),
  message: z.string(),
  created_at: z.string().nullable(),
});

export const SystemEventMetadataRowSchema = z.object({
  event_id: z.number(),
  metadata_key: z.string(),
  metadata_value: z.string(),
});

export const SystemMaintenanceRowSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(SystemMaintenanceType),
  reason: z.string(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  created_by: z.string().nullable(),
  notes: z.string().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type SystemDatabaseRow = ISystemConfigRow | ISystemModulesRow | ISystemModuleMetadataRow | ISystemEventsRow | ISystemEventMetadataRow | ISystemMaintenanceRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const SystemDatabaseRowSchema = z.union([SystemConfigRowSchema, SystemModulesRowSchema, SystemModuleMetadataRowSchema, SystemEventsRowSchema, SystemEventMetadataRowSchema, SystemMaintenanceRowSchema]);

/**
 * Database table names for this module
 */
export const SYSTEM_TABLES = {
  SYSTEM_CONFIG: 'system_config',
  SYSTEM_MODULES: 'system_modules',
  SYSTEM_MODULE_METADATA: 'system_module_metadata',
  SYSTEM_EVENTS: 'system_events',
  SYSTEM_EVENT_METADATA: 'system_event_metadata',
  SYSTEM_MAINTENANCE: 'system_maintenance',
} as const;
