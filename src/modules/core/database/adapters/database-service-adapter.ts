/**
 * Database Service Adapter to implement DatabaseConnection interface.
 * @file Database Service Adapter to implement DatabaseConnection interface.
 * @module src/modules/core/database/adapters/database-service-adapter
 */

import type {
  IDatabaseConnection,
  IPreparedStatement,
  ITransaction
} from '@/modules/core/database/types/manual';
import type { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Adapter class that wraps DatabaseService to implement DatabaseConnection interface.
 */
export class DatabaseServiceAdapter implements IDatabaseConnection {
  /**
   * Creates a new DatabaseServiceAdapter instance.
   * @param databaseService - The database service to adapt.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Executes a SQL query and returns the results.
   * @param sql - The SQL query string.
   * @param params - Optional parameters for the query.
   * @returns A promise that resolves to the query result.
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    return await this.databaseService.query<T>(sql, params);
  }

  /**
   * Executes a SQL statement without returning results.
   * @param sql - The SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns A promise that resolves when execution is complete.
   */
  async execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    const result = await this.databaseService.execute(sql, params);
    return result;
  }

  /**
   * Runs a SQL statement and returns the result.
   * @param sql - The SQL statement to run.
   * @param params - Optional parameters for the statement.
   * @returns A promise that resolves to the result.
   */
  async run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    return await this.execute(sql, params);
  }

  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement to prepare.
   * @returns A promise that resolves to a prepared statement.
   * @throws Error if getConnection is not available.
   */
  async prepare(sql: string): Promise<IPreparedStatement> {
    const preparedStatement: IPreparedStatement = {
      query: async <T = unknown>(params?: unknown[]): Promise<T[]> => {
        return await this.query<T>(sql, params);
      },
      execute: async (params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> => {
        return await this.execute(sql, params);
      },
      finalize: async (): Promise<void> => {
      }
    };
    return preparedStatement;
  }

  /**
   * Executes a function within a database transaction.
   * @param handler - The function to execute within the transaction.
   * @returns A promise that resolves to the result of the handler.
   */
  async transaction<T>(handler: (tx: ITransaction) => Promise<T>): Promise<T> {
    return await this.databaseService.transaction(async (conn): Promise<T> => {
      const txAdapter: ITransaction = {
        query: async <R = unknown>(sql: string, params?: unknown[]): Promise<{ rows: R[] }> => {
          const result = await conn.query<R>(sql, params);
          return { rows: result };
        },
        execute: async (sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> => {
          return await conn.execute(sql, params);
        },
        commit: async (): Promise<void> => {
        },
        rollback: async (): Promise<void> => {
          throw new Error('Manual rollback requested');
        }
      };
      return await handler(txAdapter);
    });
  }

  /**
   * Closes the database connection.
   * @returns A promise that resolves when the connection is closed.
   */
  async close(): Promise<void> {
    await this.databaseService.disconnect();
  }
}
