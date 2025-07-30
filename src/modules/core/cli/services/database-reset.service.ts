/**
 * Database reset CLI service wrapper.
 * Provides a clean interface for CLI commands to perform complete database reset operations.
 */
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { RebuildHelperService } from '@/modules/core/database/services/rebuild-helper.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Parameters for the reset operation.
 */
export interface IResetParams {
  force: boolean;
  confirm: boolean;
}

/**
 * Result of a reset operation.
 */
export interface IResetResult {
  success: boolean;
  message: string;
  details?: {
    databaseRemoved: boolean;
    schemasFound: number;
    filesImported: number;
    errors: string[];
  };
}

/**
 * Database Reset Service - Handles complete database reset operations.
 * Provides confirmation mechanisms and completely removes the database file before recreation.
 */
export class DatabaseResetService {
  private static instance: DatabaseResetService;

  /**
   * Get singleton instance.
   * @returns DatabaseResetService instance.
   */
  public static getInstance(): DatabaseResetService {
    DatabaseResetService.instance ||= new DatabaseResetService();
    return DatabaseResetService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Private constructor
  }

  /**
   * Handle database reset operation.
   * @param params - Reset parameters containing force and confirm flags.
   * @param logger - Optional logger instance.
   * @returns Promise resolving to reset result.
   */
  public async handleReset(
    params: IResetParams,
    logger?: ILogger
  ): Promise<IResetResult> {
    try {
      if (!params.force && !params.confirm) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed with complete database reset.'
        };
      }

      const dbService = DatabaseService.getInstance();
      let databaseRemoved = false;

      // Step 1: Remove the database file completely
      try {
        // Get the database file path from the service
        const dbPath = this.getDatabasePath();
        
        if (existsSync(dbPath)) {
          // Close any existing connections first
          try {
            await dbService.close();
          } catch (error) {
            // Connection might already be closed, that's OK
          }

          await unlink(dbPath);
          databaseRemoved = true;
          if (logger) {
            logger.info('DATABASE_RESET', `Database file removed: ${dbPath}`);
          }
        } else {
          if (logger) {
            logger.info('DATABASE_RESET', 'Database file does not exist, nothing to remove');
          }
        }

        // Also remove WAL and SHM files if they exist
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;
        
        if (existsSync(walPath)) {
          await unlink(walPath);
          if (logger) {
            logger.info('DATABASE_RESET', `WAL file removed: ${walPath}`);
          }
        }
        
        if (existsSync(shmPath)) {
          await unlink(shmPath);
          if (logger) {
            logger.info('DATABASE_RESET', `SHM file removed: ${shmPath}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: `Failed to remove database file: ${errorMessage}`,
          details: {
            databaseRemoved: false,
            schemasFound: 0,
            filesImported: 0,
            errors: [errorMessage]
          }
        };
      }

      // Step 2: Reinitialize the database service
      try {
        await dbService.initialize();
        if (logger) {
          logger.info('DATABASE_RESET', 'Database service reinitialized');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: `Failed to reinitialize database: ${errorMessage}`,
          details: {
            databaseRemoved,
            schemasFound: 0,
            filesImported: 0,
            errors: [errorMessage]
          }
        };
      }

      // Step 3: Discover and import schemas
      const discoveryResult = await RebuildHelperService.discoverSchemas(logger);
      if (!discoveryResult.success) {
        return {
          success: false,
          message: 'Failed to discover schema files after reset',
          details: {
            databaseRemoved,
            schemasFound: discoveryResult.schemasFound,
            filesImported: 0,
            errors: ['Failed to discover schema files']
          }
        };
      }

      const importResult = await RebuildHelperService.importSchemas(
        discoveryResult.schemaFiles,
        logger
      );
      if (!importResult.importSuccess) {
        return {
          success: false,
          message: `Schema import failed with ${String(importResult.errors.length)} errors after reset`,
          details: {
            databaseRemoved,
            schemasFound: discoveryResult.schemasFound,
            filesImported: importResult.filesImported,
            errors: importResult.errors
          }
        };
      }

      // Step 4: Optimize the new database
      await RebuildHelperService.optimizeDatabase(logger);

      return {
        success: true,
        message: 'Database reset completed successfully',
        details: {
          databaseRemoved,
          schemasFound: discoveryResult.schemasFound,
          filesImported: importResult.filesImported,
          errors: []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Database reset failed: ${errorMessage}`,
        details: {
          databaseRemoved: false,
          schemasFound: 0,
          filesImported: 0,
          errors: [errorMessage]
        }
      };
    }
  }

  /**
   * Get the database file path.
   * This is a simplified approach - in reality this should get the path from configuration.
   * @returns Database file path.
   */
  private getDatabasePath(): string {
    // This should ideally come from configuration
    // For now, using a reasonable default that matches the project structure
    return './state/database.db';
  }
}