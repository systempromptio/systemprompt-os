/**
 * SQLite database connection implementation.
 * @file SQLite database connection implementation.
 * @module database/adapters/sqlite-connection
 */

import type * as Database from 'better-sqlite3';
import type {
  IDatabaseConnection,
  ITransaction
} from '../types/manual';
import { SqliteTransaction } from './sqlite-transaction.adapter';

/**
 * SQLite database connection implementation.
 */
export class SqliteConnection implements IDatabaseConnection {
  private readonly db: Database.Database;

  /**
   * Creates a new SQLite connection.
   * @param db - The SQLite database instance.
   */
  public constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Execute a query and return results.
   * @param sql - SQL query to execute.
   * @param params - Optional parameters for the query.
   * @returns Query result with typed rows.
   */
  public async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const queryParams = params ?? [];
    const rows = stmt.all(...queryParams);
    return rows as T[];
  }

  /**
   * Execute a statement without returning results.
   * @param sql - SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns Promise that resolves when complete.
   */
  public async execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (params !== undefined && params.length > 0) {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
 changes: result.changes,
lastInsertRowid: Number(result.lastInsertRowid)
};
    }
    this.db.exec(sql);
    return {
 changes: 0,
lastInsertRowid: 0
};
  }

  /**
   * Runs a SQL statement and returns the result.
   * @param sql - The SQL statement to run.
   * @param params - Optional parameters for the statement.
   * @returns A promise that resolves to the result.
   */
  public async run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    return await this.execute(sql, params);
  }

  /**
   * Execute a function within a transaction.
   * @param fn - Function to execute within transaction.
   * @returns Result of the callback function.
   */
  public async transaction<T>(fn: (tx: ITransaction) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    const tx = new SqliteTransaction(this.db);

    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  /**
   * Close the database connection.
   * @returns Promise that resolves when closed.
   */
  public async close(): Promise<void> {
    this.db.close();
  }
}
