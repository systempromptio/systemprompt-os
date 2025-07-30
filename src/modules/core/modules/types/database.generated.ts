// Auto-generated database types for modules module
// Generated on: 2025-07-30T22:16:41.626Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum ModulesType {
  CORE = 'core',
  CUSTOM = 'custom',
  SERVICE = 'service',
  DAEMON = 'daemon',
  PLUGIN = 'plugin',
  EXTENSION = 'extension'
}

export enum ModulesStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  INSTALLED = 'installed',
  LOADING = 'loading'
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
  status: ModulesStatus | null;
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

/**
 * Union type of all database row types in this module
 */
export type ModulesDatabaseRow = IModulesRow | IModuleEventsRow;

/**
 * Database table names for this module
 */
export const MODULES_TABLES = {
  MODULES: 'modules',
  MODULEEVENTS: 'module_events',
} as const;
