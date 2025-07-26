/**
 * @file Database Service Adapter to implement DatabaseConnection interface.
 * @module src/modules/core/database/adapters/database-service-adapter
 */

import type {
 DatabaseConnection, PreparedStatement, QueryResult, Transaction
} from '@/modules/core/database/interfaces/database.interface';
import type { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Adapter class that wraps DatabaseService to implement DatabaseConnection interface.
 */
export class DatabaseServiceAdapter implements DatabaseConnection {
  constructor(private readonly databaseService: DatabaseService) {}

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const rows = await this.databaseService.query<T>(sql, params);
    return {
      rows,
      rowCount: rows.length
    };
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    await this.databaseService.execute(sql, params);
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    const connection = await (this.databaseService as any).getConnection();
    return await connection.prepare(sql);
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return await this.databaseService.transaction(async (conn) => {
      const txAdapter: Transaction = {
        query: async (sql: string, params?: any[]) => {
          return await conn.query(sql, params);
        },
        execute: conn.execute.bind(conn),
        prepare: conn.prepare.bind(conn),
        commit: async () => {
        },
        rollback: async () => {
          throw new Error('Manual rollback requested');
        }
      };
      return await callback(txAdapter);
    });
  }

  async close(): Promise<void> {
    await this.databaseService.disconnect();
  }
}
