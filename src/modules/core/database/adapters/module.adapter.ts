/**
 * Module-specific database adapter for SystemPrompt OS modules.
 * @file Module-specific database adapter for SystemPrompt OS modules.
 * @module database/adapters/module.adapter
 */

import type { Database } from 'better-sqlite3';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type {
  IDatabaseRow,
  IModuleDatabaseAdapter,
  IModulePreparedStatement,
  IMutationResult
} from '@/modules/core/database/types/module-adapter.types';
import { ZERO } from '@/modules/core/database/constants/index';

/**
 * Helper to get database instance from service.
 * @param dbService - Database service instance.
 * @returns Database instance.
 */
const getDbInstance = async (dbService: any): Promise<Database> => {
  const adapterAccess = dbService.adapter;
  if (!adapterAccess?.db) {
    throw new Error('Database adapter not available');
  }
  return adapterAccess.db as Database;
};

/**
 * Adapter for SQLite database connections.
 * Provides a consistent interface for modules to interact with the database.
 */
export class SqliteModuleAdapter implements IModuleDatabaseAdapter {
  private readonly db: Database;

  /**
   * Creates a new SQLite module adapter.
   * @param db - The SQLite database instance.
   */
  public constructor(db: Database) {
    this.db = db;
  }

  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement to prepare.
   * @returns A prepared statement object.
   */
  public prepare<T = IDatabaseRow>(sql: string): IModulePreparedStatement<T> {
    const stmt = this.db.prepare(sql);

    return {
      all: (...params: unknown[]): T[] => {
        const result = stmt.all(...params);
        return Array.isArray(result) ? (result as T[]) : [];
      },
      get: (...params: unknown[]): T | undefined => {
        const result = stmt.get(...params);
        return result === undefined ? undefined : (result as T);
      },
      run: (...params: unknown[]): IMutationResult => {
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        };
      }
    };
  }

  /**
   * Executes a SQL script.
   * @param sql - The SQL script to execute.
   */
  public exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Executes a function within a database transaction.
   * @param fn - The function to execute.
   * @returns The result of the function.
   */
  public transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Execute a query and return results.
   * @param sql - The SQL query to execute.
   * @param params - Optional parameters for the query.
   * @returns Promise resolving to array of results.
   */
  public async query<T = IDatabaseRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const queryParams = params ?? [];
    const result = stmt.all(...queryParams);
    return await Promise.resolve(Array.isArray(result) ? (result as T[]) : []);
  }

  /**
   * Execute a statement without returning results.
   * @param sql - The SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns Promise resolving when execution is complete.
   */
  public async execute(sql: string, params?: unknown[]): Promise<void> {
    if (params !== undefined && params.length > ZERO) {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } else {
      this.db.exec(sql);
    }
    await Promise.resolve();
  }
}

/**
 * Creates a module database adapter from the database service.
 * @param moduleName - The name of the module requesting the adapter.
 * @param _moduleName
 * @returns A module database adapter instance.
 * @throws Error if the database is not SQLite or adapter is not available.
 */
export const createModuleAdapter = async (_moduleName: string): Promise<IModuleDatabaseAdapter> => {
  const dbService = DatabaseService.getInstance();

  await dbService.getConnection();

  if (dbService.getDatabaseType() !== 'sqlite') {
    throw new Error(
      'Module adapter currently only supports SQLite database'
    );
  }

  const db = await getDbInstance(dbService);

  if (db === undefined) {
    throw new Error(
      'SQLite database instance not available'
    );
  }

  return new SqliteModuleAdapter(db);
};
