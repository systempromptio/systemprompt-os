/**
 * Database rebuild CLI service wrapper.
 * Provides a clean interface for CLI commands to perform database rebuild operations.
 */
import { RebuildHelperService } from '@/modules/core/database/services/rebuild-helper.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types/manual';

/**
 * Parameters for the rebuild operation.
 */
export interface IRebuildParams {
  force: boolean;
  confirm: boolean;
}

/**
 * Result of a rebuild operation.
 */
export interface IRebuildResult {
  success: boolean;
  message: string;
  details?: {
    tablesDropped: number;
    schemasFound: number;
    filesImported: number;
    errors: string[];
  };
}

/**
 * Database Rebuild Service - Handles complete database rebuild operations.
 * Provides confirmation mechanisms and wraps lower-level database services.
 */
export class DatabaseRebuildService {
  private static instance: DatabaseRebuildService;

  /**
   * Get singleton instance.
   * @returns DatabaseRebuildService instance.
   */
  public static getInstance(): DatabaseRebuildService {
    DatabaseRebuildService.instance ||= new DatabaseRebuildService();
    return DatabaseRebuildService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Private constructor
  }

  /**
   * Handle database rebuild operation.
   * @param params - Rebuild parameters containing force and confirm flags.
   * @param logger - Optional logger instance.
   * @returns Promise resolving to rebuild result.
   */
  public async handleRebuild(
    params: IRebuildParams,
    logger?: ILogger
  ): Promise<IRebuildResult> {
    try {
      if (!params.force && !params.confirm) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed.'
        };
      }

      const db = DatabaseService.getInstance();
      const tables = await db.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );
      
      const dropResult = await RebuildHelperService.dropAllTables(tables, logger);
      if (!dropResult.success) {
        return {
          success: false,
          message: dropResult.message ?? 'Failed to drop existing tables',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: 0,
            filesImported: 0,
            errors: ['Failed to drop existing tables']
          }
        };
      }

      const discoveryResult = await RebuildHelperService.discoverSchemas(logger);
      if (!discoveryResult.success) {
        return {
          success: false,
          message: 'Failed to discover schema files',
          details: {
            tablesDropped: dropResult.tablesDropped,
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
          message: `Schema import failed with ${String(importResult.errors.length)} errors`,
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: discoveryResult.schemasFound,
            filesImported: importResult.filesImported,
            errors: importResult.errors
          }
        };
      }

      await RebuildHelperService.optimizeDatabase(logger);

      return {
        success: true,
        message: 'Database rebuild completed successfully',
        details: {
          tablesDropped: dropResult.tablesDropped,
          schemasFound: discoveryResult.schemasFound,
          filesImported: importResult.filesImported,
          errors: []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Database rebuild failed: ${errorMessage}`,
        details: {
          tablesDropped: 0,
          schemasFound: 0,
          filesImported: 0,
          errors: [errorMessage]
        }
      };
    }
  }
}
