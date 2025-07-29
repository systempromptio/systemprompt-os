/**
 * Database row type returned from queries.
 */
export interface IDatabaseRow {
  [column: string]: unknown;
}

/**
 * Result type for database queries.
 */
export interface IModuleQueryResult<T = IDatabaseRow> {
  rows: T[];
  rowCount: number;
}

/**
 * Result type for database mutations.
 */
export interface IMutationResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Prepared statement interface for modules.
 */
export interface IModulePreparedStatement<T = IDatabaseRow> {
  all(...params: unknown[]): Promise<T[]>;
  get(...params: unknown[]): Promise<T | undefined>;
  run(...params: unknown[]): Promise<IMutationResult>;
}

/**
 * Transaction interface for module database operations.
 */
export interface IModuleTransaction {
  prepare<T = IDatabaseRow>(sql: string): IModulePreparedStatement<T>;
  exec(sql: string): void;
  rollback(): void;
}

/**
 * Module database adapter interface.
 */
export interface IModuleDatabaseAdapter {
  prepare<T = IDatabaseRow>(sql: string): IModulePreparedStatement<T>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  query<T = IDatabaseRow>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<IMutationResult>;
}
