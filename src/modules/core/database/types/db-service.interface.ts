/**
 * Database service interface.
 * @file Database service interface.
 * @module database/types/db-service.interface
 */

import type { IDatabaseConfig, IQueryResult } from '@/modules/core/database/types/database.types.js';

/**
 * Prepared statement interface.
 */
export interface IPreparedStatement {
  execute(params?: unknown[]): Promise<IQueryResult>;
  all<T = unknown>(params?: unknown[]): Promise<T[]>;
  get<T = unknown>(params?: unknown[]): Promise<T | undefined>;
  run(params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | string }>;
  finalize(): Promise<void>;
}

/**
 * Database service interface.
 */
export interface IDatabaseService {
  connect(config: IDatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query(sql: string, params?: unknown[]): Promise<IQueryResult>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  prepare(sql: string): Promise<IPreparedStatement>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  getDatabaseType(): 'sqlite' | 'postgres';
  getConnection(): Promise<unknown>;
}
