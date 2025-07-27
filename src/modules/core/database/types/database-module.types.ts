/**
 * Database module types.
 */

import type { IDatabaseService } from '@/modules/core/database/types/db-service.interface';
import type { IModuleDatabaseAdapter } from '@/modules/core/database/types/module-adapter.types';
import type { SchemaService } from '@/modules/core/database/services/schema.service';
import type { MigrationService } from '@/modules/core/database/services/migration.service';
import type { SchemaImportService } from '@/modules/core/database/services/schema-import.service';
import type { SQLParserService } from '@/modules/core/database/services/sql-parser.service';
import type { DatabaseCLIHandlerService } from '@/modules/core/database/services/cli-handler.service';

/**
 * Strongly typed exports interface for Database module.
 */
export interface IDatabaseModuleExports {
  readonly service: () => IDatabaseService;
  readonly schemaService: () => SchemaService;
  readonly migrationService: () => MigrationService;
  readonly schemaImportService: () => SchemaImportService;
  readonly sqlParserService: () => SQLParserService;
  readonly cliHandlerService: () => DatabaseCLIHandlerService;
  readonly createModuleAdapter: (moduleName: string) => Promise<IModuleDatabaseAdapter>;
}

/**
 * Database adapter for internal use.
 */
export interface IDatabaseAdapter {
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  transaction: <T>(fn: (conn: {
    execute(sql: string, params?: unknown[]): Promise<void>;
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  }) => Promise<T>) => Promise<T>;
}
