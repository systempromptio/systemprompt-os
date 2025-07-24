/**
 * Database service types.
 * @module modules/core/database/types
 */

export interface IDatabaseService {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface IDatabaseModule {
  getInstance(): IDatabaseService;
}
