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

/**
 * Summary parameters for database summary operations.
 */
export interface ISummaryParams {
  format?: 'text' | 'json' | 'table';
  includeSystem?: boolean;
  sortBy?: 'name' | 'rows' | 'columns';
}

/**
 * Summary statistics for database tables.
 */
export interface ISummaryStats {
  totalTables: number;
  totalRows: number;
  totalColumns: number;
  schemaVersion?: string;
}

/**
 * Table information.
 */
export interface ITableInfo {
  name: string;
  rows: number;
  columns: number;
  rowCount: number;
  columnCount: number;
  schema?: string;
}

/**
 * Database connection interface.
 */
export interface IDatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  close(): Promise<void>;
}

/**
 * Database adapter interface.
 */
export interface IDatabaseAdapter {
  connect(): Promise<IDatabaseConnection>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
}

/**
 * Summary result for database operations.
 */
export interface ISummaryResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Database connection interface for summary operations.
 */
export interface IDatabaseConnectionForSummary {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
