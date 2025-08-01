// Auto-generated database types for modules module
// Generated on: 2025-08-01T14:00:38.801Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum ModulesType {
  CORE = 'core',
  CUSTOM = 'custom',
  SERVICE = 'service',
  DAEMON = 'daemon',
  PLUGIN = 'plugin',
  EXTENSION = 'extension'
}

export enum ModulesHealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum ModuleEventsEventType {
  DISCOVERED = 'discovered',
  INSTALLED = 'installed',
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  CONFIG_CHANGED = 'config_changed'
}

// Zod schemas for enums
export const ModulesTypeSchema = z.nativeEnum(ModulesType);
export const ModulesHealthStatusSchema = z.nativeEnum(ModulesHealthStatus);
export const ModuleEventsEventTypeSchema = z.nativeEnum(ModuleEventsEventType);

/**
 * Generated from database table: modules
 * Do not modify this file manually - it will be overwritten
 */
export interface IModulesRow {
  id: number;
  name: string;
  version: string;
  type: ModulesType;
  path: string;
  description: string | null;
  author: string | null;
  enabled: boolean | null;
  auto_start: boolean | null;
  dependencies: string | null;
  config: string | null;
  metadata: string | null;
  status: string | null;
  last_error: string | null;
  discovered_at: string | null;
  last_started_at: string | null;
  last_stopped_at: string | null;
  health_status: ModulesHealthStatus | null;
  health_message: string | null;
  last_health_check: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: module_events
 * Do not modify this file manually - it will be overwritten
 */
export interface IModuleEventsRow {
  id: number;
  module_id: number;
  event_type: ModuleEventsEventType;
  event_message: string | null;
  event_data: string | null;
  created_at: string | null;
}

// Zod schemas for database row validation
export const ModulesRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  version: z.string(),
  type: z.nativeEnum(ModulesType),
  path: z.string(),
  description: z.string().nullable(),
  author: z.string().nullable(),
  enabled: z.boolean().nullable(),
  auto_start: z.boolean().nullable(),
  dependencies: z.string().nullable(),
  config: z.string().nullable(),
  metadata: z.string().nullable(),
  status: z.string().nullable(),
  last_error: z.string().nullable(),
  discovered_at: z.string().datetime().nullable(),
  last_started_at: z.string().datetime().nullable(),
  last_stopped_at: z.string().datetime().nullable(),
  health_status: z.nativeEnum(ModulesHealthStatus).nullable(),
  health_message: z.string().nullable(),
  last_health_check: z.string().datetime().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const ModuleEventsRowSchema = z.object({
  id: z.number(),
  module_id: z.number(),
  event_type: z.nativeEnum(ModuleEventsEventType),
  event_message: z.string().nullable(),
  event_data: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type ModulesDatabaseRow = IModulesRow | IModuleEventsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const ModulesDatabaseRowSchema = z.union([ModulesRowSchema, ModuleEventsRowSchema]);

/**
 * Database table names for this module
 */
export const MODULES_TABLES = {
  MODULES: 'modules',
  MODULE_EVENTS: 'module_events',
} as const;
