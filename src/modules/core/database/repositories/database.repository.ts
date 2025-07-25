/**
 * Database repository interface.
 * @file Database repository interface.
 * @module database/repositories/database.repository
 */

import type { IDatabaseConfig, IDatabaseConnection } from '@/modules/core/database/types/database.types';
import type { IModuleSchema } from '@/modules/core/database/types/schema.types';
import type { IMigration } from '@/modules/core/database/types/migration.types';

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
  discoverSchemas(baseDir: string): Promise<IModuleSchema[]>;
  initializeSchemas(schemas: IModuleSchema[]): Promise<void>;
  getSchema(module: string): IModuleSchema | undefined;
  getAllSchemas(): Map<string, IModuleSchema>;
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
