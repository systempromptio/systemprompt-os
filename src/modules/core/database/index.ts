/**
 * Core Database Module
 * 
 * Provides centralized database management for all SystemPrompt OS modules.
 * Supports SQLite by default with PostgreSQL compatibility for future migration.
 */

import { ModuleInterface, ModuleContext } from '@/modules/types';
import { DatabaseService } from './services/database.service';
import { SchemaService } from './services/schema.service';
import { MigrationService } from './services/migration.service';
import { Logger } from '@/modules/core/logger/types';
import type { DatabaseConfig } from './types';

// Re-export all types
export * from './types';

// Re-export services
export { DatabaseService, SchemaService, MigrationService };

// Re-export adapters
export { createModuleAdapter, type ModuleDatabaseAdapter } from './adapters/module-adapter';

/**
 * Database Module Implementation
 */
export class DatabaseModule implements ModuleInterface {
  name = 'database';
  version = '1.0.0';
  type: 'core' = 'core';

  private config?: DatabaseConfig;
  private logger?: Logger;
  private initialized = false;

  /**
   * Initialize the database module with context
   */
  async initialize(context: ModuleContext): Promise<void> {
    if (this.initialized) {
      throw new Error(`Module ${this.name} already initialized`);
    }

    this.logger = context.logger;
    
    // Build configuration from context and environment
    this.config = this.buildConfig(context.config);
    
    this.logger?.info(`Initializing module ${this.name}`, {
      type: this.config.type
    });

    // Initialize services with configuration
    const dbService = DatabaseService.initialize(this.config, this.logger);
    SchemaService.initialize(dbService, this.logger);
    MigrationService.initialize(dbService, this.logger);

    this.initialized = true;
    this.logger?.info(`Module ${this.name} initialized successfully`);
  }

  /**
   * Start the database module
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error(`Module ${this.name} not initialized`);
    }

    this.logger?.info(`Starting module ${this.name}`);

    try {
      const dbService = DatabaseService.getInstance();
      const schemaService = SchemaService.getInstance();
      const migrationService = MigrationService.getInstance();

      // Connect to database
      await dbService.getConnection();

      // Discover and initialize schemas
      const modulesPath = process.env.NODE_ENV === 'production' 
        ? '/app/src/modules'
        : new URL('../../', import.meta.url).pathname;
      
      await schemaService.discoverSchemas(modulesPath);
      await schemaService.initializeSchemas();

      // Run migrations if auto-run is enabled
      if (this.config?.migrations?.autoRun !== false) {
        await migrationService.discoverMigrations(modulesPath);
        await migrationService.runMigrations();
      }

      this.logger?.info(`Module ${this.name} started successfully`);
    } catch (error) {
      this.logger?.error(`Failed to start module ${this.name}`, { error });
      throw error;
    }
  }

  /**
   * Stop the database module
   */
  async stop(): Promise<void> {
    this.logger?.info(`Stopping module ${this.name}`);

    try {
      const dbService = DatabaseService.getInstance();
      await dbService.disconnect();
      this.logger?.info(`Module ${this.name} stopped successfully`);
    } catch (error) {
      this.logger?.error(`Error stopping module ${this.name}`, { error });
      throw error;
    }
  }

  /**
   * Perform health check on the database module
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const dbService = DatabaseService.getInstance();
      const isConnected = await dbService.isConnected();
      
      if (!isConnected) {
        return {
          healthy: false,
          message: 'Database connection is not active'
        };
      }

      // Test database connectivity with a simple query
      await dbService.query('SELECT 1');

      return {
        healthy: true,
        message: `Module ${this.name} is healthy`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${error.message}`
      };
    }
  }

  /**
   * Get module exports
   */
  get exports() {
    return {
      services: {
        database: DatabaseService.getInstance(),
        schema: SchemaService.getInstance(), 
        migration: MigrationService.getInstance()
      },
      adapters: {
        createModuleAdapter
      },
      types: require('./types')
    };
  }

  /**
   * Build database configuration from context and environment
   */
  private buildConfig(contextConfig?: any): DatabaseConfig {
    return {
      type: contextConfig?.type || process.env.DATABASE_TYPE as 'sqlite' | 'postgres' || 'sqlite',
      sqlite: {
        filename: contextConfig?.sqlite?.filename || process.env.DATABASE_FILE || '/data/state/systemprompt.db',
        mode: contextConfig?.sqlite?.mode || process.env.SQLITE_MODE || 'wal'
      },
      postgres: {
        host: contextConfig?.postgres?.host || process.env.POSTGRES_HOST || 'localhost',
        port: contextConfig?.postgres?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
        database: contextConfig?.postgres?.database || process.env.POSTGRES_DB || 'systemprompt',
        user: contextConfig?.postgres?.user || process.env.POSTGRES_USER || 'systemprompt',
        password: contextConfig?.postgres?.password || process.env.POSTGRES_PASSWORD,
        ssl: contextConfig?.postgres?.ssl || process.env.POSTGRES_SSL === 'true'
      },
      pool: {
        min: contextConfig?.pool?.min || parseInt(process.env.DB_POOL_MIN || '1'),
        max: contextConfig?.pool?.max || parseInt(process.env.DB_POOL_MAX || '10'),
        idleTimeout: contextConfig?.pool?.idleTimeout || parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
      },
      migrations: {
        autoRun: contextConfig?.migrations?.auto_run !== false && process.env.DB_AUTO_MIGRATE !== 'false',
        directory: contextConfig?.migrations?.directory || 'database/migrations'
      },
      schema: {
        scanPattern: contextConfig?.schema?.scan_pattern || '*/database/schema.sql',
        initPattern: contextConfig?.schema?.init_pattern || '*/database/init.sql'
      }
    };
  }
}

// Export default instance
export default new DatabaseModule();

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

export async function initializeDatabase(config?: Partial<DatabaseConfig>): Promise<void> {
  console.warn('initializeDatabase() is deprecated. Module initialization is handled by the module loader.');
  // This function is kept for backward compatibility but does nothing
  // The module loader will handle initialization through the ModuleInterface
}

export async function shutdownDatabase(): Promise<void> {
  console.warn('shutdownDatabase() is deprecated. Module shutdown is handled by the module loader.');
  // This function is kept for backward compatibility but does nothing
  // The module loader will handle shutdown through the ModuleInterface
}