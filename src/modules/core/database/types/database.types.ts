/**
 * Database configuration.
 */
export interface IDatabaseConfig {
  type: 'sqlite' | 'postgres';
  sqlite?: {
    filename: string;
    mode?: 'wal' | 'journal';
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
    ssl?: boolean;
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
}

/**
 * Query result.
 */
export interface IQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  fields?: string[];
}

/**
 * Prepared statement.
 */
export interface IPreparedStatement {
  execute(params?: unknown[]): Promise<IQueryResult>;
  all<T = unknown>(params?: unknown[]): Promise<T[]>;
  get<T = unknown>(params?: unknown[]): Promise<T | undefined>;
  run(params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | string }>;
  finalize(): Promise<void>;
}

/**
 * Transaction.
 */
export interface ITransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<IQueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  prepare(sql: string): Promise<IPreparedStatement>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Database connection.
 */
export interface IDatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  prepare(sql: string): Promise<IPreparedStatement>;
  transaction<T>(fn: (tx: ITransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Database adapter.
 */
export interface IDatabaseAdapter {
  connect(config: IDatabaseConfig): Promise<IDatabaseConnection>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Migration file.
 */
export interface IMigrationFile {
  version: string;
  module: string;
  filename: string;
  sql: string;
}

/**
 * Column definition.
 */
export interface IColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  default?: unknown;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

/**
 * Index definition.
 */
export interface IIndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * Constraint definition.
 */
export interface IConstraintDefinition {
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'FOREIGN KEY';
  definition: string;
}

/**
 * Table definition.
 */
export interface ITableDefinition {
  name: string;
  columns: IColumnDefinition[];
  indexes?: IIndexDefinition[];
  constraints?: IConstraintDefinition[];
}

/**
 * Schema definition.
 */
export interface ISchemaDefinition {
  module: string;
  tables: ITableDefinition[];
  version: string;
}
