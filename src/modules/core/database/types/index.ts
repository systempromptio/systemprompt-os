/**
 * Database service configuration.
 */
export interface IDatabaseServiceConfig {
  type: 'sqlite' | 'postgres';
  sqlite?: {
    filename: string;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  pool?: {
    min: number;
    max: number;
    idleTimeout: number;
  };
  migrations?: {
    autoRun?: boolean;
    directory?: string;
  };
  schema?: {
    scanPattern?: string;
    initPattern?: string;
  };
}

/**
 * Migration status.
 */
export interface IMigrationStatus {
  module: string;
  version: string;
  appliedAt: Date;
  checksum?: string;
}

/**
 * Migration plan.
 */
export interface IMigrationPlan {
  pending: Array<{ module: string; version: string; filename: string }>;
  applied: IMigrationStatus[];
  conflicts?: Array<{
    migration: { module: string; version: string; filename: string };
    reason: string;
  }>;
}

/**
 * Schema status.
 */
export interface ISchemaStatus {
  module: string;
  initialized: boolean;
  version?: string;
  tables: string[];
  lastUpdated?: Date;
}

/**
 * Schema validation result.
 */
export interface ISchemaValidationResult {
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

/**
 * Connection pool status.
 */
export interface IPoolStatus {
  active: number;
  idle: number;
  waiting: number;
  max: number;
}

/**
 * Database error details.
 */
export interface IDatabaseErrorDetails {
  code?: string;
  query?: string;
  params?: unknown[];
  module?: string;
}

/**
 * Database type.
 */
export type DatabaseType = 'sqlite' | 'postgres';

/**
 * Transaction isolation level.
 */
export type TransactionIsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';
