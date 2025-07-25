/**
 * Database service interface for SystemPrompt OS modules
 * Provides a simplified API for database operations
 */

/**
 * Database service interface
 */
export interface IDatabaseService {
  /**
   * Execute a query and return all rows
   */
  all<T = any>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;

  /**
   * Execute a query and return the first row
   */
  get<T = any>(sql: string, params?: readonly unknown[]): Promise<T | null>;

  /**
   * Execute a statement that doesn't return data
   */
  run(sql: string, params?: readonly unknown[]): Promise<void>;

  /**
   * Execute raw SQL
   */
  exec(sql: string): Promise<void>;

  /**
   * Prepare a statement for repeated execution
   */
  prepare(sql: string): IPreparedStatement;
}

/**
 * Prepared statement interface
 */
export interface IPreparedStatement {
  run(...params: readonly unknown[]): void;
  get<T>(...params: readonly unknown[]): T | undefined;
  all<T>(...params: readonly unknown[]): readonly T[];
  finalize(): void;
}