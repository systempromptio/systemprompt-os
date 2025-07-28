// Auto-generated database types for modules module
// Generated on: 2025-07-28T20:02:59.642Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: modules
 * Do not modify this file manually - it will be overwritten
 */
export interface IModulesRow {
  id: number;
  name: string;
  version: string;
  type: string;
  path: string;
  enabled: boolean | null;
  auto_start: boolean | null;
  dependencies: string | null;
  config: string | null;
  status: string | null;
  lasterror: string | null;
  discovered_at: string | null;
  last_started_at: string | null;
  last_stopped_at: string | null;
  health_status: string | null;
  health_message: string | null;
  last_health_check: string | null;
  metadata: string | null;
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
  event_type: string;
  event_data: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: module_dependencies
 * Do not modify this file manually - it will be overwritten
 */
export interface IModuleDependenciesRow {
  id: number;
  module_id: number;
  dependency_name: string;
  required: boolean | null;
  version_constraint: string | null;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type ModulesDatabaseRow = IModulesRow | IModuleEventsRow | IModuleDependenciesRow;

/**
 * Database table names for this module
 */
export const MODULES_TABLES = {
  MODULES: 'modules',
  MODULEEVENTS: 'module_events',
  MODULEDEPENDENCIES: 'module_dependencies',
} as const;
