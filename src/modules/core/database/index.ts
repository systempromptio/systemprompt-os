/**
 * Core Database Module.
 * Provides centralized database management for all SystemPrompt OS modules.
 * Supports SQLite by default with PostgreSQL compatibility for future migration.
 */

import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SchemaService } from '@/modules/core/database/services/schema.service.js';
import { MigrationService } from '@/modules/core/database/services/migration.service.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import type { DatabaseConfig } from '@/modules/core/database/types/index.js';

// Re-export all types
export * from '@/modules/core/database/types/index.js';

// Re-export services
export {
 DatabaseService, SchemaService, MigrationService
};

// Re-export adapters
export { createModuleAdapter, type ModuleDatabaseAdapter } from '@/modules/core/database/adapters/module-adapter.js';

/**
 * Database Module Implementation - self-contained.
 */
export class DatabaseModule implements IModule {
  name = 'database';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['logger'];
  // @ts-expect-error - Will be used when database configuration is implemented
  private readonly config?: DatabaseConfig;
  // @ts-expect-error - Will be used for initialization tracking
  private readonly initialized = false;
  private readonly logger = LoggerService.getInstance();
  get exports() {
    return {
      service: DatabaseService.getInstance(),
      services: {
        database: DatabaseService.getInstance(),
        schema: SchemaService.getInstance(),
        migration: MigrationService.getInstance(),
      },
      adapters: {
        createModuleAdapter: null, // Will be loaded dynamically when needed
      },
      types: import('./types/index.js'),
    };
  }

  /**
   * Build database configuration from environment.
   */
  private buildConfig(): DatabaseConfig {
    const config: DatabaseConfig = {
      type: (process.env['DATABASE_TYPE'] as 'sqlite' | 'postgres') || 'sqlite',
      pool: {
        min: parseInt(process.env['DB_POOL_MIN'] || '1'),
        max: parseInt(process.env['DB_POOL_MAX'] || '10'),
        idleTimeout: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
      },
      migrations: {
        autoRun: process.env['DB_AUTO_MIGRATE'] !== 'false',
        directory: 'database/migrations',
      },
    };

    // Add SQLite config if type is sqlite
    if (config.type === 'sqlite') {
      config.sqlite = {
        filename: process.env['SQLITE_FILENAME'] || './state/database.db',
      };
    }

    return config;
  }

  /**
   * Initialize the database module.
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing module database', { config: this.buildConfig() });

    // Initialize the database service first (this creates the singleton instance)
    const config = this.buildConfig();
    await DatabaseService.initialize(config, this.logger);

    // Now we can get the instance
    const dbService = DatabaseService.getInstance();

    // Initialize schema service
    const schemaService = SchemaService.initialize(dbService, this.logger);

    // Initialize migration service
    // @ts-expect-error - Migration service initialized but not used yet
    const migrationService = MigrationService.initialize(dbService, this.logger);

    // Discover and import schemas
    const modulesPath
      = process.env['NODE_ENV'] === 'production'
        ? '/app/src/modules'
        : `${process.cwd()}/src/modules`;

    await schemaService.discoverSchemas(modulesPath);
    await schemaService.initializeSchemas();

    this.logger.info('Module database initialized successfully');
  }

  /**
   * Start the database module.
   */
  async start(): Promise<void> {
    this.status = ModuleStatus.RUNNING;
    this.logger.info('Database module started');
  }

  /**
   * Stop the database module.
   */
  async stop(): Promise<void> {
    this.status = ModuleStatus.STOPPED;
    await DatabaseService.getInstance().disconnect();
    this.logger.info('Database module stopped');
  }

  /**
   * Health check for the database module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.query('SELECT 1');
      return {
 healthy: true,
message: 'Database is healthy'
};
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Factory function for creating the module.
 */
export function createModule(): DatabaseModule {
  return new DatabaseModule();
}

// Legacy compatibility exports (deprecated)
export function getDatabase(): DatabaseService {
  console.warn('getDatabase() is deprecated. Use DatabaseService.getInstance() instead.');
  return DatabaseService.getInstance();
}

export function getSchemaService(): SchemaService {
  console.warn('getSchemaService() is deprecated. Use SchemaService.getInstance() instead.');
  return SchemaService.getInstance();
}

export function getMigrationService(): MigrationService {
  console.warn('getMigrationService() is deprecated. Use MigrationService.getInstance() instead.');
  return MigrationService.getInstance();
}
