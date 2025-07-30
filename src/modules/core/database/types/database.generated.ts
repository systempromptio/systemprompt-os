// Auto-generated database types for database module
// Generated on: 2025-07-30T07:52:14.637Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum DatabaseOperationsOperationType {
  SCHEMA_IMPORT = 'schema_import',
  MIGRATION = 'migration',
  REBUILD = 'rebuild',
  CLEAR = 'clear',
  QUERY = 'query'
}

export enum DatabaseOperationsStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial'
}

export enum DatabaseHealthChecksCheckType {
  CONNECTION = 'connection',
  SCHEMA_VALIDITY = 'schema_validity',
  INTEGRITY = 'integrity',
  PERFORMANCE = 'performance'
}

export enum DatabaseHealthChecksStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Generated from database table: database_schema_versions
 * Do not modify this file manually - it will be overwritten
 */
export interface IDatabaseSchemaVersionsRow {
  id: number;
  module_name: string;
  version: string;
  checksum: string;
  applied_at: string | null;
  execution_time_ms: number | null;
  statements_count: number | null;
}

/**
 * Generated from database table: database_migrations
 * Do not modify this file manually - it will be overwritten
 */
export interface IDatabaseMigrationsRow {
  id: number;
  module_name: string;
  version: string;
  filename: string;
  checksum: string;
  applied_at: string | null;
  execution_time_ms: number | null;
  rollback_sql: string | null;
}

/**
 * Generated from database table: database_operations
 * Do not modify this file manually - it will be overwritten
 */
export interface IDatabaseOperationsRow {
  id: number;
  operation_type: DatabaseOperationsOperationType;
  module_name: string | null;
  status: DatabaseOperationsStatus;
  error_message: string | null;
  affected_rows: number | null;
  execution_time_ms: number | null;
  created_at: string | null;
}

/**
 * Generated from database table: database_health_checks
 * Do not modify this file manually - it will be overwritten
 */
export interface IDatabaseHealthChecksRow {
  id: number;
  check_type: DatabaseHealthChecksCheckType;
  status: DatabaseHealthChecksStatus;
  details: string | null;
  response_time_ms: number | null;
  checked_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type DatabaseDatabaseRow = IDatabaseSchemaVersionsRow | IDatabaseMigrationsRow | IDatabaseOperationsRow | IDatabaseHealthChecksRow;

/**
 * Database table names for this module
 */
export const DATABASE_TABLES = {
  DATABASESCHEMAVERSIONS: 'database_schema_versions',
  DATABASEMIGRATIONS: 'database_migrations',
  DATABASEOPERATIONS: 'database_operations',
  DATABASEHEALTHCHECKS: 'database_health_checks',
} as const;
