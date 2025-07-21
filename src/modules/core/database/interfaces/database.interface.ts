/**
 * Database adapter interface for abstraction across different databases
 * Supports both SQLite and PostgreSQL with a common API
 */

export interface DatabaseConfig {
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
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: string[];
}

export interface PreparedStatement {
  execute(params?: any[]): Promise<QueryResult>;
  all<T = any>(params?: any[]): Promise<T[]>;
  get<T = any>(params?: any[]): Promise<T | undefined>;
  run(params?: any[]): Promise<{ changes: number; lastInsertRowid: number | string }>;
  finalize(): Promise<void>;
}

export interface Transaction {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: any[]): Promise<void>;
  prepare(sql: string): Promise<PreparedStatement>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: any[]): Promise<void>;
  prepare(sql: string): Promise<PreparedStatement>;
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<DatabaseConnection>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface MigrationFile {
  version: string;
  module: string;
  filename: string;
  sql: string;
}

export interface SchemaDefinition {
  module: string;
  tables: TableDefinition[];
  version: string;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  constraints?: ConstraintDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  default?: any;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ConstraintDefinition {
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'FOREIGN KEY';
  definition: string;
}