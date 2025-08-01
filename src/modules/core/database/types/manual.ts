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
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
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

/**
 * Database service interface.
 */
export interface IDatabaseService {
  isConnected(): Promise<boolean>;
  isInitialized(): Promise<boolean>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction<T>(callback: (tx: IDatabaseService) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Database configuration interface.
 */
export interface IDatabaseConfig {
  type: 'sqlite' | 'postgres';
  sqlite?: {
    filename: string;
    pragma?: Record<string, string | number>;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
  pool?: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
}

/**
 * Prepared statement interface.
 */
export interface IPreparedStatement {
  query<T = unknown>(params?: unknown[]): Promise<T[]>;
  execute(params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  finalize(): Promise<void>;
}

/**
 * Transaction interface.
 */
export interface ITransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// CLI Types
export interface IViewOptions {
  table?: string;
  limit?: number;
  offset?: number;
  format?: 'table' | 'json' | 'csv';
  where?: string;
  orderBy?: string;
}

export interface IViewContext {
  args: Record<string, unknown> & {
    table?: string;
    limit?: number;
    offset?: number;
    format?: 'table' | 'json' | 'csv';
    where?: string;
    'order-by'?: string;
  };
}

// Database Module Types
export interface IDatabaseModuleConfig {
  type: 'sqlite' | 'postgres';
  connection: {
    sqlite?: {
      filename: string;
      pragma?: Record<string, string | number>;
    };
    postgres?: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
    };
  };
  pool?: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
  migrations?: {
    directory: string;
    tableName: string;
    schemaVersionsTable: string;
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    queries: boolean;
  };
}

// Database Service Interface
export interface IDbService {
  isConnected(): Promise<boolean>;
  isInitialized(): Promise<boolean>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction<T>(callback: (tx: IDbService) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Migration Types
export interface IMigration {
  module: string;
  version: string;
  filename: string;
  content: string;
  checksum: string;
}

export interface IMigrationResult {
  success: boolean;
  error?: string;
  executionTime?: number;
  affectedRows?: number;
}

export interface IMigrationOptions {
  dryRun?: boolean;
  module?: string;
  force?: boolean;
}

// Rollback Types
export interface IRollbackOptions {
  version?: string;
  module?: string;
  steps?: number;
  dryRun?: boolean;
}

export interface IRollbackResult {
  success: boolean;
  rolledBackMigrations: string[];
  error?: string;
}

// Schema Types
export interface ISchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface ISchemaTable {
  name: string;
  columns: ISchemaColumn[];
  indexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

export interface ISchemaModule {
  name: string;
  tables: ISchemaTable[];
  version: string;
}

export interface ISchemaImportOptions {
  module?: string;
  force?: boolean;
  validate?: boolean;
}

export interface ISchemaImportResult {
  success: boolean;
  importedModules: string[];
  errors?: string[];
  warnings?: string[];
}

// SQL Parser Types
export interface ISqlStatement {
  type: 'CREATE_TABLE' | 'CREATE_INDEX' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT' | 'DROP_TABLE' | 'ALTER_TABLE';
  sql: string;
  table?: string;
  dependencies?: string[];
}

export interface ISqlParseResult {
  statements: ISqlStatement[];
  errors: Array<{
    line: number;
    message: string;
  }>;
}

// Module Adapter Types
export interface IModuleAdapterConfig {
  module: string;
  database: IDatabaseServiceConfig;
  services: {
    logger: unknown;
    config: unknown;
  };
}

export interface IModuleAdapter {
  initialize(): Promise<void>;
  getService<T>(name: string): T;
  isInitialized(): boolean;
}

// Schema Service Types
export interface ISchemaServiceConfig {
  schemaDirectory: string;
  modulePattern: string;
  fileExtensions: string[];
}

export interface ISchemaValidationOptions {
  strict?: boolean;
  skipForeignKeys?: boolean;
  allowMissingTables?: boolean;
}

// Summary Types (already defined in index.ts, but included for completeness)
export interface ISummaryData {
  stats: ISummaryStats;
  tables: ITableInfo[];
  timestamp: string;
}
