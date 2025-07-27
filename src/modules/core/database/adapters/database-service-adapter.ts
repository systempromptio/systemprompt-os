/**
 * Database Service Adapter to implement DatabaseConnection interface.
 * @file Database Service Adapter to implement DatabaseConnection interface.
 * @module src/modules/core/database/adapters/database-service-adapter
 */

import type {
  IDatabaseConnection,
  IPreparedStatement,
  IQueryResult,
  ITransaction
} from '@/modules/core/database/types/database.types';
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
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<IQueryResult<T>> {
    const rows = await this.databaseService.query<T>(sql, params);
    return {
      rows,
      rowCount: rows.length
    };
  }

  /**
   * Executes a SQL statement without returning results.
   * @param sql - The SQL statement to execute.
   * @param params - Optional parameters for the statement.
   * @returns A promise that resolves when execution is complete.
   */
  async execute(sql: string, params?: unknown[]): Promise<void> {
    await this.databaseService.execute(sql, params);
  }

  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement to prepare.
   * @returns A promise that resolves to a prepared statement.
   * @throws Error if getConnection is not available.
   */
  async prepare(sql: string): Promise<IPreparedStatement> {
    // Since DatabaseService doesn't expose prepared statement functionality,
    // we create an adapter that uses regular queries
    const preparedStatement: IPreparedStatement = {
      execute: async (params?: unknown[]): Promise<IQueryResult> => {
        return await this.query(sql, params);
      },
      all: async <T = unknown>(params?: unknown[]): Promise<T[]> => {
        const result = await this.query<T>(sql, params);
        return result.rows;
      },
      get: async <T = unknown>(params?: unknown[]): Promise<T | undefined> => {
        const result = await this.query<T>(sql, params);
        return result.rows[0];
      },
      run: async (params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | string }> => {
        await this.execute(sql, params);
        // Since we don't have access to changes/lastInsertRowid through DatabaseService,
        // return default values. This is a limitation of the adapter pattern.
        return { changes: 0, lastInsertRowid: 0 };
      },
      finalize: async (): Promise<void> => {
        // No-op for this adapter implementation
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
        query: async <R = unknown>(sql: string, params?: unknown[]): Promise<IQueryResult<R>> => {
          return await conn.query<R>(sql, params);
        },
        execute: conn.execute.bind(conn),
        prepare: conn.prepare.bind(conn),
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
