/**
 * Core Database Module.
 * Provides centralized database management for all SystemPrompt OS modules.
 * @file Core database module index.
 * @module database
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import { SchemaImportService } from '@/modules/core/database/services/schema-import.service';
import { SQLParserService } from '@/modules/core/database/services/sql-parser.service';
import { DatabaseCLIHandlerService } from '@/modules/core/database/services/cli-handler.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { IDatabaseConfig } from '@/modules/core/database/types/database.types';
import type { IDatabaseService } from '@/modules/core/database/types/db-service.interface';
import { type IModule, ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { createModuleAdapter } from '@/modules/core/database/adapters/module.adapter';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type {
  IDatabaseAdapter,
  IDatabaseModuleExports
} from '@/modules/core/database/types/database-module.types';
import type { IModuleDatabaseAdapter } from '@/modules/core/database/types/module-adapter.types';

/**
 * Type guard to check if a module is a Database module.
 * @param moduleToCheck - The module to check for database module interface.
 * @returns True if module is a Database module.
 */
export const isDatabaseModule = (
  moduleToCheck: unknown
): moduleToCheck is IModule<IDatabaseModuleExports> => {
  if (typeof moduleToCheck !== 'object' || moduleToCheck === null) {
    return false;
  }

  const obj = moduleToCheck;

  if (!('name' in obj) || obj.name !== 'database') {
    return false;
  }

  if (!('exports' in obj) || typeof obj.exports !== 'object' || obj.exports === null) {
    return false;
  }

  const moduleExports = obj.exports;

  return 'service' in moduleExports && typeof moduleExports.service === 'function';
};

/**
 * Export services.
 */
export {
  DatabaseService,
  SchemaService,
  MigrationService,
  SchemaImportService,
  SQLParserService,
  DatabaseCLIHandlerService,
};

/**
 * Export adapter creator.
 */
export { createModuleAdapter };

/**
 * Database module implementation.
 * @class DatabaseModule
 */
export class DatabaseModule implements IModule<IDatabaseModuleExports> {
  public readonly name = 'database';
  public readonly type = 'core' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Core database management for SystemPrompt OS';
  public readonly dependencies: string[] = [];
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private initialized = false;
  private started = false;
  private logger!: ILogger;
  get exports(): IDatabaseModuleExports {
    return {
      service: (): IDatabaseService => { return this.getService() },
      schemaService: (): SchemaService => { return SchemaService.getInstance() },
      migrationService: (): MigrationService => { return MigrationService.getInstance() },
      schemaImportService: (): SchemaImportService =>
        { return SchemaImportService.getInstance() },
      sqlParserService: (): SQLParserService => { return SQLParserService.getInstance() },
      cliHandlerService: (): DatabaseCLIHandlerService =>
        { return DatabaseCLIHandlerService.getInstance() },
      createModuleAdapter: async (
        moduleName: string
      ): Promise<IModuleDatabaseAdapter> => { return await createModuleAdapter(moduleName) },
    };
  }

  /**
   * Get database service instance.
   * @returns {DatabaseService} Database service.
   */
  getService(): DatabaseService {
    if (!this.initialized) {
      throw new Error('Database module not initialized');
    }
    return DatabaseService.getInstance();
  }

  /**
   * Set logger for the module.
   * @param {ILogger} logger - Logger instance.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Build database configuration.
   * @returns {IDatabaseConfig} Database configuration.
   */
  private buildConfig(): IDatabaseConfig {
    const DEFAULT_POOL_MIN = '1';
    const DEFAULT_POOL_MAX = '10';
    const DEFAULT_IDLE_TIMEOUT = '30000';
    const RADIX_BASE = 10;

    const config: IDatabaseConfig = {
      type: process.env.DATABASE_TYPE === 'postgres' ? 'postgres' : 'sqlite',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN ?? DEFAULT_POOL_MIN, RADIX_BASE),
        max: parseInt(process.env.DB_POOL_MAX ?? DEFAULT_POOL_MAX, RADIX_BASE),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT ?? DEFAULT_IDLE_TIMEOUT, RADIX_BASE),
      },
    };

    if (config.type === 'sqlite') {
      config.sqlite = {
        filename: process.env.SQLITE_FILENAME ?? './state/database.db',
      };
    }

    if (config.type === 'postgres') {
      config.postgres = {
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: parseInt(process.env.POSTGRES_PORT ?? '5432', RADIX_BASE),
        database: process.env.POSTGRES_DB ?? 'systemprompt',
        user: process.env.POSTGRES_USER ?? 'systemprompt',
        password: process.env.POSTGRES_PASSWORD ?? '',
      };
    }

    return config;
  }

  /**
   * Create database adapter.
   * @param {DatabaseService} dbService - Database service instance.
   * @returns {IDatabaseAdapter} Database adapter.
   */
  private createDatabaseAdapter(dbService: DatabaseService): IDatabaseAdapter {
    return {
      execute: async (sql: string, params?: unknown[]): Promise<void> => {
        await dbService.execute(sql, params);
      },
      query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
        return await dbService.query<T>(sql, params);
      },
      transaction: async <TResult>(fn: (conn: {
        execute(sql: string, params?: unknown[]): Promise<void>;
        query<TQuery>(sql: string, params?: unknown[]): Promise<TQuery[]>;
      }) => Promise<TResult>): Promise<TResult> => {
        return await dbService.transaction(async (conn) => {
          return await fn({
            execute: async (sql: string, params?: unknown[]): Promise<void> => {
              await conn.execute(sql, params);
            },
            query: async <TQuery>(sql: string, params?: unknown[]): Promise<TQuery[]> => {
              const result = await conn.query<TQuery>(sql, params);
              return result.rows;
            }
          });
        });
      }
    };
  }

  /**
   * Initialize the database module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    await this.initializeInternal();
  }

  /**
   * Internal initialization logic.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  private async initializeInternal(): Promise<void> {
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Database module already initialized');
    }

    try {
      const config = this.buildConfig();

      const dbService = DatabaseService.initialize(config, this.logger);
      const sqlParser = SQLParserService.initialize(this.logger);

      const dbAdapter = this.createDatabaseAdapter(dbService);

      const schemaImport = SchemaImportService.initialize(
        dbAdapter,
        sqlParser,
        this.logger
      );
      const schemaService = SchemaService.initialize(dbAdapter, schemaImport, this.logger);
      MigrationService.initialize(dbService, this.logger);

      const modulesPath = process.env.NODE_ENV === 'production'
        ? '/app/src/modules'
        : `${process.cwd()}/src/modules`;

      await schemaService.discoverSchemas(modulesPath);
      await schemaService.initializeSchemas();

      this.initialized = true;
      this.logger.info(LogSource.DATABASE, 'Database module initialized successfully', {
        category: 'initialization',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(LogSource.DATABASE, 'Database module initialization failed', {
        category: 'initialization',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw new Error(`Failed to initialize database module: ${errorMessage}`);
    }
  }

  /**
   * Start the database module.
   * @returns {Promise<void>} Promise that resolves when started.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database module not initialized');
    }

    if (this.started) {
      throw new Error('Database module already started');
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.DATABASE, 'Database module started', { category: 'startup' });
  }

  /**
   * Stop the database module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.logger.info(LogSource.DATABASE, 'Database module stopping', { category: 'shutdown' });

      try {
        const dbService = DatabaseService.getInstance();
        await dbService.disconnect();
        this.logger.info(LogSource.DATABASE, 'Database connection closed', {
          category: 'shutdown'
        });
      } catch (error) {
        this.logger.error(LogSource.DATABASE, 'Error closing database connection', {
          category: 'shutdown',
          error: error instanceof Error ? error : new Error(String(error))
        });
      }

      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.DATABASE, 'Database module stopped', { category: 'shutdown' });
    }
  }

  /**
   * Perform health check on the database module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return await this.performHealthCheck();
  }

  /**
   * Internal health check implementation.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  private async performHealthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Database module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Database module not started',
      };
    }

    try {
      const dbService = DatabaseService.getInstance();
      await dbService.query('SELECT 1');
      return {
        healthy: true,
        message: 'Database module is healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Factory function for creating the module.
 * @returns {DatabaseModule} Database module instance.
 */
export const createModule = (): DatabaseModule => {
  return new DatabaseModule();
};

/**
 * Gets the Database module with type safety and validation.
 * @returns The Database module with guaranteed typed exports.
 * @throws {Error} If Database module is not available or missing required exports.
 */
export function getDatabaseModule(): IModule<IDatabaseModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');

  const moduleLoader = getModuleLoader();
  const databaseModule = moduleLoader.getModule(ModuleName.DATABASE);

  if (!databaseModule.exports?.service || typeof databaseModule.exports.service !== 'function') {
    throw new Error('Database module missing required service export');
  }

  if (!databaseModule.exports?.schemaService || typeof databaseModule.exports.schemaService !== 'function') {
    throw new Error('Database module missing required schemaService export');
  }

  if (!databaseModule.exports?.migrationService || typeof databaseModule.exports.migrationService !== 'function') {
    throw new Error('Database module missing required migrationService export');
  }

  if (!databaseModule.exports?.createModuleAdapter || typeof databaseModule.exports.createModuleAdapter !== 'function') {
    throw new Error('Database module missing required createModuleAdapter export');
  }

  return databaseModule as IModule<IDatabaseModuleExports>;
}

/**
 * Initialize the database module.
 * @param logger - Logger instance.
 * @returns Promise that resolves when initialization is complete.
 */
export const initialize = async (logger?: ILogger): Promise<void> => {
  const DEFAULT_POOL_MIN = '1';
  const DEFAULT_POOL_MAX = '10';
  const DEFAULT_IDLE_TIMEOUT = '30000';
  const RADIX_BASE = 10;

  const config: IDatabaseConfig = {
    type: process.env.DATABASE_TYPE === 'postgres' ? 'postgres' : 'sqlite',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN ?? DEFAULT_POOL_MIN, RADIX_BASE),
      max: parseInt(process.env.DB_POOL_MAX ?? DEFAULT_POOL_MAX, RADIX_BASE),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT ?? DEFAULT_IDLE_TIMEOUT, RADIX_BASE),
    },
  };

  if (config.type === 'sqlite') {
    config.sqlite = {
      filename: process.env.SQLITE_FILENAME ?? './state/database.db',
    };
  }

  const dbService = DatabaseService.initialize(config, logger);
  const sqlParser = SQLParserService.initialize(logger);

  const dbAdapter = {
    execute: async (sql: string, params?: unknown[]): Promise<void> => { await dbService.execute(sql, params); },
    query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => { return await dbService.query<T>(sql, params); },
    transaction: async <T>(fn: (conn: {
      execute(sql: string, params?: unknown[]): Promise<void>;
      query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    }) => Promise<T>) => { return await dbService.transaction(async (conn: {
      execute(sql: string, params?: unknown[]): Promise<void>;
      query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
    }) => {
      return await fn({
        execute: async (sql: string, params?: unknown[]) => { await conn.execute(sql, params); },
        query: async <T>(sql: string, params?: unknown[]) => {
          const result = await conn.query<T>(sql, params);
          return result.rows;
        }
      });
    }) }
  };

  const schemaImport = SchemaImportService.initialize(dbAdapter, sqlParser, logger);
  const schemaService = SchemaService.initialize(dbAdapter, schemaImport, logger);
  MigrationService.initialize(dbService, logger);

  const modulesPath
    = process.env.NODE_ENV === 'production' ? '/app/src/modules' : `${process.cwd()}/src/modules`;

  await schemaService.discoverSchemas(modulesPath);
  await schemaService.initializeSchemas();

  logger?.info(LogSource.DATABASE, 'Database module initialized successfully', {
    category: 'initialization',
  });
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
