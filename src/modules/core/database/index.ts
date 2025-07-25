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
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IDatabaseConfig } from '@/modules/core/database/types/database.types';
import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { createModuleAdapter } from '@/modules/core/database/adapters/module.adapter';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Strongly typed exports interface for Database module.
 */
export interface IDatabaseModuleExports {
  readonly service: () => DatabaseService;
  readonly schemaService: () => SchemaService;
  readonly migrationService: () => MigrationService;
  readonly schemaImportService: () => SchemaImportService;
  readonly sqlParserService: () => SQLParserService;
  readonly cliHandlerService: () => DatabaseCLIHandlerService;
  readonly createModuleAdapter: (moduleName: string) => ReturnType<typeof createModuleAdapter>;
}

/**
 * Type guard to check if a module is a Database module.
 * @param module - Module to check.
 * @returns True if module is a Database module.
 */
export function isDatabaseModule(module: any): module is IModule<IDatabaseModuleExports> {
  return (
    module?.name === 'database' &&
    Boolean(module.exports) &&
    typeof module.exports === 'object' &&
    'service' in module.exports &&
    typeof module.exports.service === 'function'
  );
}

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
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private initialized = false;
  private started = false;
  private logger!: ILogger;
  get exports(): IDatabaseModuleExports {
    return {
      service: () => {
        return this.getService();
      },
      schemaService: () => {
        return SchemaService.getInstance();
      },
      migrationService: () => {
        return MigrationService.getInstance();
      },
      schemaImportService: () => {
        return SchemaImportService.getInstance();
      },
      sqlParserService: () => {
        return SQLParserService.getInstance();
      },
      cliHandlerService: () => {
        return DatabaseCLIHandlerService.getInstance();
      },
      createModuleAdapter: async (moduleName: string) => {
        return await createModuleAdapter(moduleName);
      },
    };
  }

  /**
   * Initialize the database module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Database module already initialized');
    }

    try {
      const config = buildConfig();

      const dbService = DatabaseService.initialize(config, this.logger);
      const sqlParser = SQLParserService.initialize(this.logger);
      const schemaImport = SchemaImportService.initialize(dbService as any, sqlParser, this.logger);
      const schemaService = SchemaService.initialize(dbService, schemaImport, this.logger);
      MigrationService.initialize(dbService, this.logger);

      const modulesPath =
        process.env.NODE_ENV === 'production' ? '/app/src/modules' : `${process.cwd()}/src/modules`;

      await schemaService.discoverSchemas(modulesPath);
      await schemaService.initializeSchemas();

      this.initialized = true;
      this.logger?.info(LogSource.DATABASE, 'Database module initialized successfully', {
        category: 'initialization',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(LogSource.DATABASE, 'Database module initialization failed', {
        category: 'initialization',
        error: error as Error,
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

    this.started = true;
    this.logger?.info(LogSource.DATABASE, 'Database module started', { category: 'startup' });
  }

  /**
   * Stop the database module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.logger?.info(LogSource.DATABASE, 'Database module stopping', { category: 'shutdown' });
      this.started = false;
    }
  }

  /**
   * Perform health check on the database module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
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
}

/**
 * Factory function for creating the module.
 * @returns {DatabaseModule} Database module instance.
 */
export const createModule = (): DatabaseModule => {
  return new DatabaseModule();
};

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
  const schemaImport = SchemaImportService.initialize(dbService as any, sqlParser, logger);
  const schemaService = SchemaService.initialize(dbService, schemaImport, logger);
  MigrationService.initialize(dbService, logger);

  const modulesPath =
    process.env.NODE_ENV === 'production' ? '/app/src/modules' : `${process.cwd()}/src/modules`;

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
