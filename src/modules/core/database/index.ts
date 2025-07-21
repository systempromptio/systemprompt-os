/**
 * Core Database Module
 * 
 * Provides centralized database management for all SystemPrompt OS modules.
 * Supports SQLite by default with PostgreSQL compatibility for future migration.
 */

import { DatabaseService } from './services/database.service.js';
import { SchemaService } from './services/schema.service.js';
import { MigrationService } from './services/migration.service.js';
import { logger } from '@utils/logger.js';
import type { DatabaseConfig } from './interfaces/database.interface.js';

export * from './interfaces/database.interface.js';
export { DatabaseService, SchemaService, MigrationService };

/**
 * Initialize the database module
 */
export async function initializeDatabase(config?: Partial<DatabaseConfig>): Promise<void> {
  try {
    // Default configuration
    const defaultConfig: DatabaseConfig = {
      type: process.env.DATABASE_TYPE as 'sqlite' | 'postgres' || 'sqlite',
      sqlite: {
        filename: process.env.DATABASE_FILE || '/data/state/systemprompt.db',
        mode: 'wal'
      },
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'systemprompt',
        user: process.env.POSTGRES_USER || 'systemprompt',
        password: process.env.POSTGRES_PASSWORD,
        ssl: process.env.POSTGRES_SSL === 'true'
      },
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '1'),
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
      }
    };

    const finalConfig = { ...defaultConfig, ...config };

    logger.info('Initializing database module', { 
      type: finalConfig.type 
    });

    // Initialize services
    const dbService = DatabaseService.initialize(finalConfig);
    const schemaService = SchemaService.initialize(dbService);
    const migrationService = MigrationService.initialize(dbService);

    // Connect to database
    await dbService.getConnection();

    // Discover and initialize schemas
    const modulesPath = process.env.NODE_ENV === 'production' 
      ? '/app/src/modules'
      : new URL('../../', import.meta.url).pathname;
    await schemaService.discoverSchemas(modulesPath);
    await schemaService.initializeSchemas();

    // Run migrations
    await migrationService.discoverMigrations(modulesPath);
    await migrationService.runMigrations();

    logger.info('Database module initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database module', { error });
    throw error;
  }
}

/**
 * Get database service instance
 */
export function getDatabase(): DatabaseService {
  return DatabaseService.getInstance();
}

/**
 * Get schema service instance
 */
export function getSchemaService(): SchemaService {
  return SchemaService.getInstance();
}

/**
 * Get migration service instance
 */
export function getMigrationService(): MigrationService {
  return MigrationService.getInstance();
}

/**
 * Shutdown database connections
 */
export async function shutdownDatabase(): Promise<void> {
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.disconnect();
    logger.info('Database module shutdown complete');
  } catch (error) {
    logger.error('Error during database shutdown', { error });
  }
}