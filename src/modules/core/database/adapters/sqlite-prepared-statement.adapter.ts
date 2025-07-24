/**
 * SQLite prepared statement implementation.
 * @file SQLite prepared statement implementation.
 * @module database/adapters/sqlite-prepared-statement.adapter
 */

import type BetterSqlite3 from 'better-sqlite3';
import type { IPreparedStatement, IQueryResult } from '@/modules/core/database/types/database.types.js';

/**
 * SQLite prepared statement implementation.
 */
export class SqlitePreparedStatement implements IPreparedStatement {
  private readonly stmt: BetterSqlite3.Statement;

  /**
   * Creates a new SQLite prepared statement.
   * @param stmt - The better-sqlite3 statement.
   */
  public constructor(stmt: BetterSqlite3.Statement) {
    this.stmt = stmt;
  }

  /**
   * Execute the prepared statement and return results.
   * @param params - Optional parameters for the statement.
   * @returns Query result with rows and count.
   */
  public async execute(params?: unknown[]): Promise<IQueryResult> {
    const queryParams = params ?? [];
    const rows = this.stmt.all(...queryParams);
    const queryResult = {
      rows,
      rowCount: rows.length,
    };
    return await Promise.resolve(queryResult);
  }

  /**
   * Execute the statement and return all rows.
   * @param params - Optional parameters for the statement.
   * @returns Array of result rows.
   */
  public async all<T = unknown>(params?: unknown[]): Promise<T[]> {
    const queryParams = params ?? [];
    const result = this.stmt.all(...queryParams);
    return await Promise.resolve(result as T[]);
  }

  /**
   * Execute the statement and return the first row.
   * @param params - Optional parameters for the statement.
   * @returns First row or undefined if no results.
   */
  public async get<T = unknown>(params?: unknown[]): Promise<T | undefined> {
    const queryParams = params ?? [];
    const result = this.stmt.get(...queryParams);
    return await Promise.resolve(result as T | undefined);
  }

  /**
   * Execute a mutation statement.
   * @param params - Optional parameters for the statement.
   * @returns Object with changes count and last insert rowid.
   */
  public async run(params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | string }> {
    const queryParams = params ?? [];
    const result = this.stmt.run(...queryParams);
    const mutationResult = {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid as number,
    };
    return await Promise.resolve(mutationResult);
  }

  /**
   * Finalize the prepared statement.
   * @returns Promise that resolves when finalized.
   */
  public async finalize(): Promise<void> {
    await Promise.resolve();
  }
}
