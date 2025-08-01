/**
 * SQLite transaction implementation.
 * @file SQLite transaction implementation.
 * @module database/adapters/sqlite-transaction
 */

import type * as Database from 'better-sqlite3';
import type {
  IPreparedStatement,
  ITransaction
} from '@/modules/core/database/types/manual';
import { SqlitePreparedStatement } from '@/modules/core/database/adapters/sqlite-prepared-statement.adapter';

/**
 * SQLite transaction implementation.
 */
export class SqliteTransaction implements ITransaction {
  private readonly db: Database.Database;

  /**
   * Creates a new SQLite transaction.
   * @param db - The SQLite database instance.
   */
  public constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Execute a query within the transaction.
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
   * Execute a statement within the transaction.
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
   * Prepare a statement within the transaction.
   * @param sql - SQL statement to prepare.
   * @returns Prepared statement instance.
   */
  public async prepare(sql: string): Promise<IPreparedStatement> {
    return new SqlitePreparedStatement(this.db.prepare(sql));
  }

  /**
   * Commit the transaction.
   * @returns Promise that resolves when committed.
   */
  public async commit(): Promise<void> {
    this.db.exec('COMMIT');
  }

  /**
   * Rollback the transaction.
   * @returns Promise that resolves when rolled back.
   */
  public async rollback(): Promise<void> {
    this.db.exec('ROLLBACK');
  }
}
