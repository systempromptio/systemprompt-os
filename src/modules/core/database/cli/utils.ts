import { DatabaseService } from "@/modules/core/database/services/database.service";
import { SchemaService } from "@/modules/core/database/services/schema.service";
import { MigrationService } from "@/modules/core/database/services/migration.service";
import type { DatabaseConfig } from "@/modules/core/database/types";

let initialized = false;

/**
 * Ensure database services are initialized for CLI commands
 */
export async function ensureDatabaseInitialized(): Promise<{
  dbService: DatabaseService;
  schemaService: SchemaService;
  migrationService: MigrationService;
}> {
  if (!initialized) {
    try {
      // Initialize with configuration from environment
      const config: DatabaseConfig = {
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

      // Initialize services
      const dbService = DatabaseService.initialize(config);
      SchemaService.initialize(dbService);
      MigrationService.initialize(dbService);
      
      initialized = true;
    } catch (error) {
      // Services might already be initialized
      // Try to get existing instances
    }
  }

  return {
    dbService: DatabaseService.getInstance(),
    schemaService: SchemaService.getInstance(),
    migrationService: MigrationService.getInstance()
  };
}