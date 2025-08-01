/**
 * Database repository interface.
 * @file Database repository interface.
 * @module database/repositories/database.repository
 */

import type {
 IDatabaseConfig, IDatabaseConnection, IMigration, ISchemaModule
} from '@/modules/core/database/types/manual';

/**
 * Database repository interface.
 */
export interface IDatabaseRepository {
  connect(config: IDatabaseConfig): Promise<IDatabaseConnection>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDatabaseType(): 'sqlite' | 'postgres';
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: (conn: IDatabaseConnection) => Promise<T>): Promise<T>;
}

/**
 * Schema repository interface.
 */
export interface ISchemaRepository {
  discoverSchemas(baseDir: string): Promise<ISchemaModule[]>;
  initializeSchemas(schemas: ISchemaModule[]): Promise<void>;
  getSchema(module: string): ISchemaModule | undefined;
  getAllSchemas(): Map<string, ISchemaModule>;
  getInstalledSchemas(): Promise<Array<{ module: string; version: string; installedAt: string }>>;
}

/**
 * Migration repository interface.
 */
export interface IMigrationRepository {
  discoverMigrations(baseDir: string): Promise<IMigration[]>;
  runMigrations(migrations: IMigration[]): Promise<void>;
  getPendingMigrations(): Promise<IMigration[]>;
  getExecutedMigrations(): Promise<Array<{ module: string; version: string; executedAt: string }>>;
}
