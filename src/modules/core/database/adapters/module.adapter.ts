/**
 * Module-specific database adapter for SystemPrompt OS modules.
 * @file Module-specific database adapter for SystemPrompt OS modules.
 * @module database/adapters/module.adapter
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/manual';

// Define missing types locally
interface IDatabaseRow {
  [key: string]: unknown;
}

interface IMutationResult {
  changes: number;
  lastInsertRowid?: number;
}

interface IModulePreparedStatement {
  query<T = unknown>(params?: unknown[]): Promise<T[]>;
  execute(params?: unknown[]): Promise<IMutationResult>;
  finalize(): Promise<void>;
  all<T = unknown>(...params: unknown[]): Promise<T[]>;
  get<T = unknown>(...params: unknown[]): Promise<T | undefined>;
  run(...params: unknown[]): Promise<IMutationResult>;
}

interface IModuleDatabaseAdapter {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<IMutationResult>;
  prepare(sql: string): IModulePreparedStatement;
  close(): Promise<void>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Adapter for module database operations.
 * Provides a consistent interface for modules to interact with the database.
 */
export class SqliteModuleAdapter implements IModuleDatabaseAdapter {
  private readonly connection: IDatabaseConnection;

  /**
   * Creates a new SQLite module adapter.
   * @param connection - The database connection instance.
   */
  public constructor(connection: IDatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Get the database connection.
   * @returns The database connection.
   */
  public async getConnection(): Promise<IDatabaseConnection> {
    return this.connection;
  }

  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement to prepare.
   * @returns A prepared statement object.
   */
  public prepare(sql: string): IModulePreparedStatement {
    return {
      all: async <T = unknown>(...params: unknown[]): Promise<T[]> => {
        const result = await this.connection.query<T>(sql, params);
        return result;
      },
      get: async <T = unknown>(...params: unknown[]): Promise<T | undefined> => {
        const result = await this.connection.query<T>(sql, params);
        return result[0];
      },
      run: async (...params: unknown[]): Promise<IMutationResult> => {
        return await this.connection.execute(sql, params);
      },
      query: async <T = unknown>(params?: unknown[]): Promise<T[]> => {
        return await this.connection.query<T>(sql, params);
      },
      execute: async (params?: unknown[]): Promise<IMutationResult> => {
        return await this.connection.execute(sql, params);
      },
      finalize: async (): Promise<void> => {
      }
    };
  }

  /**
   * Executes a SQL script.
   * @param sql - The SQL script to execute.
   */
  public async exec(sql: string): Promise<void> {
    await this.connection.execute(sql);
  }

  /**
   * Executes a function within a database transaction.
   * @param callback - The function to execute within the transaction.
   * @returns The result of the function.
   */
  public async transaction<T>(callback: (tx: import('@/modules/core/database/types/manual').IDatabaseService) => Promise<T>): Promise<T> {
    const dbService = DatabaseService.getInstance();
    return await dbService.transaction(callback);
  }

  /**
   * Execute a query and return results.
   * @param sql - The SQL query to execute.
   * @param params - Optional parameters for the query.
   * @returns Promise resolving to array of results.
   */
  public async query<T = IDatabaseRow>(sql: string, params?: unknown[]): Promise<T[]> {
    return await this.connection.query<T>(sql, params);
  }

  /**
   * Execute a statement without returning results.
   * @param sql - The SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns Promise resolving to mutation result.
   */
  public async execute(sql: string, params?: unknown[]): Promise<IMutationResult> {
    return await this.connection.execute(sql, params);
  }

  /**
   * Close the database connection.
   * @returns Promise that resolves when connection is closed.
   */
  public async close(): Promise<void> {
    await this.connection.close();
  }
}

/**
 * Creates a module database adapter from the database service.
 * @param moduleName - The name of the module requesting the adapter.
 * @returns A module database adapter instance.
 * @throws Error if the database is not SQLite or adapter is not available.
 */
export const createModuleAdapter = async (
  moduleName: string
): Promise<IModuleDatabaseAdapter> => {
  const dbService = DatabaseService.getInstance();
  const connection = await dbService.getConnection();

  if (dbService.getDatabaseType() !== 'sqlite') {
    throw new Error(
      `Module adapter currently only supports SQLite database. Module: ${moduleName}`
    );
  }

  return new SqliteModuleAdapter(connection);
};
