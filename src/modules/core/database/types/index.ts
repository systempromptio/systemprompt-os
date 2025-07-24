/**
 * Database Module Types.
 * Central export point for all database-related types and interfaces.
 * This ensures consistent type usage across the SystemPrompt OS platform.
 */

// Core database interfaces
export type {
  DatabaseConfig,
  QueryResult,
  PreparedStatement,
  Transaction,
  DatabaseConnection,
  DatabaseAdapter,
  MigrationFile,
  SchemaDefinition,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ConstraintDefinition
} from '@/modules/core/database/interfaces/database.interface.js';

// Database service interface
export type {
  IDatabaseService,
  IPreparedStatement
} from '@/modules/core/database/types/db-service.interface.js';

// Module adapter types
export type {
  ModuleDatabaseAdapter,
  ModuleQueryResult,
  ModuleTransaction
} from '@/modules/core/database/adapters/module-adapter.js';

// Import types that are used in this file
import type {
 DatabaseConfig, MigrationFile, QueryResult
} from '@/modules/core/database/interfaces/database.interface.js';

// Service configurations
export interface DatabaseServiceConfig extends DatabaseConfig {
  migrations?: {
    autoRun?: boolean;
    directory?: string;
  };
  schema?: {
    scanPattern?: string;
    initPattern?: string;
  };
}

// Migration types
export interface MigrationStatus {
  module: string;
  version: string;
  appliedAt: Date;
  checksum?: string;
}

export interface MigrationPlan {
  pending: MigrationFile[];
  applied: MigrationStatus[];
  conflicts?: Array<{
    migration: MigrationFile;
    reason: string;
  }>;
}

// Schema management types
export interface SchemaStatus {
  module: string;
  initialized: boolean;
  version?: string;
  tables: string[];
  lastUpdated?: Date;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors?: Array<{
    module: string;
    table?: string;
    column?: string;
    message: string;
  }>;
  warnings?: Array<{
    module: string;
    message: string;
  }>;
}

// Query builder types (for future enhancement)
export interface QueryBuilder<T = any> {
  select(...columns: string[]): QueryBuilder<T>;
  from(table: string): QueryBuilder<T>;
  where(condition: string, ...params: any[]): QueryBuilder<T>;
  orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  build(): { sql: string; params: any[] };
  execute(): Promise<T[]>;
  first(): Promise<T | null>;
}

// Connection pool types
export interface PoolStatus {
  active: number;
  idle: number;
  waiting: number;
  max: number;
}

// Error types (will be moved to utils/errors.ts)
export interface DatabaseErrorDetails {
  code?: string;
  query?: string;
  params?: any[];
  module?: string;
}

// Utility types
export type DatabaseType = 'sqlite' | 'postgres';
export type TransactionIsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

// Type guards
export function isDatabaseConfig(obj: any): obj is DatabaseConfig {
  return obj
    && typeof obj === 'object'
    && ['sqlite', 'postgres'].includes(obj.type);
}

export function isQueryResult<T = any>(obj: any): obj is QueryResult<T> {
  return obj
    && typeof obj === 'object'
    && Array.isArray(obj.rows)
    && typeof obj.rowCount === 'number';
}

// Re-export for backward compatibility
export type { DatabaseConfig as DatabaseConfiguration } from '@/modules/core/database/interfaces/database.interface.js';

// Dependency injection tokens removed - using self-contained modules
