/**
 * Core Database Module.
 * Provides centralized database management for all SystemPrompt OS modules.
 * @file Core database module index.
 * @module database
 */

import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SchemaService } from '@/modules/core/database/services/schema.service.js';
import { MigrationService } from '@/modules/core/database/services/migration.service.js';
import { SchemaImportService } from '@/modules/core/database/services/schema-import.service.js';
import { SQLParserService } from '@/modules/core/database/services/sql-parser.service.js';
import { DatabaseCLIHandlerService } from '@/modules/core/database/services/cli-handler.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IDatabaseConfig } from '@/modules/core/database/types/database.types.js';
import { createModuleAdapter } from '@/modules/core/database/adapters/module.adapter.js';

/**
 * Export services.
 */
export {
 DatabaseService, SchemaService, MigrationService, SchemaImportService, SQLParserService,
 DatabaseCLIHandlerService
};

/**
 * Export adapter creator.
 */
export { createModuleAdapter };

/**
 * Build database configuration from environment.
 * @returns Database configuration.
 */
const buildConfig = (): IDatabaseConfig => {
  const DEFAULT_POOL_MIN = '1';
  const DEFAULT_POOL_MAX = '10';
  const DEFAULT_IDLE_TIMEOUT = '30000';
  const RADIX_BASE = 10;

  const config: IDatabaseConfig = {
    type: process.env['DATABASE_TYPE'] === 'postgres' ? 'postgres' : 'sqlite',
    pool: {
      min: parseInt(process.env['DB_POOL_MIN'] ?? DEFAULT_POOL_MIN, RADIX_BASE),
      max: parseInt(process.env['DB_POOL_MAX'] ?? DEFAULT_POOL_MAX, RADIX_BASE),
      idleTimeout: parseInt(process.env['DB_IDLE_TIMEOUT'] ?? DEFAULT_IDLE_TIMEOUT, RADIX_BASE),
    }
  };

  if (config.type === 'sqlite') {
    config.sqlite = {
      filename: process.env['SQLITE_FILENAME'] ?? './state/database.db',
    };
  }

  return config;
};

/**
 * Initialize the database module.
 * @param logger - Logger instance.
 * @returns Promise that resolves when initialization is complete.
 */
export const initialize = async (logger?: ILogger): Promise<void> => {
  const config = buildConfig();

  const dbService = DatabaseService.initialize(config, logger);
  const sqlParser = SQLParserService.initialize(logger);
  const schemaImport = SchemaImportService.initialize(dbService, sqlParser, logger);
  const schemaService = SchemaService.initialize(dbService, schemaImport, logger);
  const migrationService = MigrationService.initialize(dbService, logger);

  const modulesPath = process.env['NODE_ENV'] === 'production'
    ? '/app/src/modules'
    : `${process.cwd()}/src/modules`;

  await schemaService.discoverSchemas(modulesPath);
  await schemaService.initializeSchemas();

  logger?.info('Database module initialized successfully', { migrationService });
};

/**
 * Get database service instance.
 * @returns Database service.
 * @deprecated Use DatabaseService.getInstance() instead.
 */
export const getDatabase = (): DatabaseService => {
  return DatabaseService.getInstance();
};

/**
 * Get schema service instance.
 * @returns Schema service.
 * @deprecated Use SchemaService.getInstance() instead.
 */
export const getSchemaService = (): SchemaService => {
  return SchemaService.getInstance();
};

/**
 * Get migration service instance.
 * @returns Migration service.
 * @deprecated Use MigrationService.getInstance() instead.
 */
export const getMigrationService = (): MigrationService => {
  return MigrationService.getInstance();
};
