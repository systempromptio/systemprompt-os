/**
 * Utility functions for database CLI commands.
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import type { IMigration } from '@/modules/core/database/types/migration.types';

export interface DatabaseServices {
  dbService: DatabaseService;
  migrationService: MigrationService;
  schemaService: SchemaService;
}

export type Migration = IMigration;

/**
 * Ensures database is initialized and returns database services.
 */
export async function ensureDatabaseInitialized(): Promise<DatabaseServices> {
  const dbService = DatabaseService.getInstance();
  const migrationService = MigrationService.getInstance();
  const schemaService = SchemaService.getInstance();

  const isInitialized = await dbService.isInitialized();
  if (!isInitialized) {
    throw new Error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
  }

  return {
    dbService,
    migrationService,
    schemaService
  };
}
