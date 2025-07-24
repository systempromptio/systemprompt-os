/**
 * SQLite database connection implementation.
 * @file SQLite database connection implementation.
 * @module database/adapters/sqlite-connection
 */

import type Database from 'better-sqlite3';
import type {
  IDatabaseConnection,
  IPreparedStatement,
  IQueryResult,
  ITransaction
} from '@/modules/core/database/types/database.types.js';
import { SqlitePreparedStatement } from '@/modules/core/database/adapters/sqlite-prepared-statement.adapter';
import { SqliteTransaction } from '@/modules/core/database/adapters/sqlite-transaction.adapter';
import { ZERO } from '@/modules/core/database/constants/index.js';

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
  public async query<T = unknown>(sql: string, params?: unknown[]): Promise<IQueryResult<T>> {
    const stmt = this.db.prepare(sql);
    const queryParams = params ?? [];
    const rows = stmt.all(...queryParams);
    const queryResult = {
      rows: rows as T[],
      rowCount: rows.length,
    };
    return queryResult;
  }

  /**
   * Execute a statement without returning results.
   * @param sql - SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns Promise that resolves when complete.
   */
  public async execute(sql: string, params?: unknown[]): Promise<void> {
    if (params !== undefined && params.length > ZERO) {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } else {
      this.db.exec(sql);
    }
  }

  /**
   * Prepare a statement for repeated execution.
   * @param sql - SQL statement to prepare.
   * @returns Prepared statement instance.
   */
  public async prepare(sql: string): Promise<IPreparedStatement> {
    return new SqlitePreparedStatement(this.db.prepare(sql));
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
