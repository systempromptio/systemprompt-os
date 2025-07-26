/**
 * Database service types.
 * @module modules/core/database/types
 */

import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

export interface IDatabaseService {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(handler: (conn: IDatabaseConnection) => Promise<T>): Promise<T>;
}

export interface IDatabaseModule {
  getInstance(): IDatabaseService;
}
