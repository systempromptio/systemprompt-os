// Auto-generated database types for database module
// Generated on: 2025-07-31T13:04:43.347Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for enums
export const DatabaseOperationsOperationTypeSchema = z.nativeEnum(DatabaseOperationsOperationType);
export const DatabaseOperationsStatusSchema = z.nativeEnum(DatabaseOperationsStatus);
export const DatabaseHealthChecksCheckTypeSchema = z.nativeEnum(DatabaseHealthChecksCheckType);
export const DatabaseHealthChecksStatusSchema = z.nativeEnum(DatabaseHealthChecksStatus);

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

// Zod schemas for database row validation
export const DatabaseSchemaVersionsRowSchema = z.object({
  id: z.number(),
  module_name: z.string(),
  version: z.string(),
  checksum: z.string(),
  applied_at: z.string().datetime().nullable(),
  execution_time_ms: z.number().nullable(),
  statements_count: z.number().nullable(),
});

export const DatabaseMigrationsRowSchema = z.object({
  id: z.number(),
  module_name: z.string(),
  version: z.string(),
  filename: z.string(),
  checksum: z.string(),
  applied_at: z.string().datetime().nullable(),
  execution_time_ms: z.number().nullable(),
  rollback_sql: z.string().nullable(),
});

export const DatabaseOperationsRowSchema = z.object({
  id: z.number(),
  operation_type: z.nativeEnum(DatabaseOperationsOperationType),
  module_name: z.string().nullable(),
  status: z.nativeEnum(DatabaseOperationsStatus),
  error_message: z.string().nullable(),
  affected_rows: z.number().nullable(),
  execution_time_ms: z.number().nullable(),
  created_at: z.string().datetime().nullable(),
});

export const DatabaseHealthChecksRowSchema = z.object({
  id: z.number(),
  check_type: z.nativeEnum(DatabaseHealthChecksCheckType),
  status: z.nativeEnum(DatabaseHealthChecksStatus),
  details: z.string().nullable(),
  response_time_ms: z.number().nullable(),
  checked_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type DatabaseDatabaseRow = IDatabaseSchemaVersionsRow | IDatabaseMigrationsRow | IDatabaseOperationsRow | IDatabaseHealthChecksRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const DatabaseDatabaseRowSchema = z.union([DatabaseSchemaVersionsRowSchema, DatabaseMigrationsRowSchema, DatabaseOperationsRowSchema, DatabaseHealthChecksRowSchema]);

/**
 * Database table names for this module
 */
export const DATABASE_TABLES = {
  DATABASE_SCHEMA_VERSIONS: 'database_schema_versions',
  DATABASE_MIGRATIONS: 'database_migrations',
  DATABASE_OPERATIONS: 'database_operations',
  DATABASE_HEALTH_CHECKS: 'database_health_checks',
} as const;
