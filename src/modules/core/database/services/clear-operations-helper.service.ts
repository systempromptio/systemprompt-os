import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';
import type { IDatabaseService } from '@/modules/core/database/types/db-service.interface';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Helper service for database clear operations.
 * Implements singleton pattern as required for core modules.
 */
export class ClearOperationsHelperService {
  private static instance: ClearOperationsHelperService | null = null;
  private databaseService!: IDatabaseService;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
  }

  /**
   * Initialize the clear operations helper service.
   * @param databaseService - Database service instance.
   * @param logger - Optional logger instance.
   * @returns The initialized clear operations helper service instance.
   */
  public static initialize(databaseService: IDatabaseService): ClearOperationsHelperService {
    ClearOperationsHelperService.instance ??= new ClearOperationsHelperService();
    ClearOperationsHelperService.instance.databaseService = databaseService;
    ClearOperationsHelperService.instance.initialized = true;
    return ClearOperationsHelperService.instance;
  }

  /**
   * Get singleton instance of ClearOperationsHelperService.
   * @returns The singleton instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): ClearOperationsHelperService {
    if (ClearOperationsHelperService.instance?.initialized !== true) {
      throw new Error('ClearOperationsHelperService not initialized. Call initialize() first.');
    }
    return ClearOperationsHelperService.instance;
  }
  /**
   * Clear tables with transaction support.
   * @param tables - Array of table names.
   * @param logger - Logger instance.
   * @returns Clear operation result.
   */
  public async clearTables(
    tables: Array<{ name: string }>,
    logger?: ILogger
  ): Promise<{
    clearedCount: number;
    failedTables: string[];
    totalRowsCleared: number;
  }> {
    let clearedCount = 0;
    let totalRowsCleared = 0;
    const failedTables: string[] = [];

    await this.databaseService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
      for (const table of tables) {
        try {
          const beforeCount = await conn.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM \`${table.name}\``
          );
          const rowsBefore = beforeCount.rows[0]?.count ?? 0;

          await conn.execute(`DELETE FROM \`${table.name}\``);

          if (logger != null) {
            logger.info(
              LogSource.DATABASE,
              `Cleared ${table.name} (${rowsBefore.toLocaleString()} rows deleted)`
            );
          }
          clearedCount += 1;
          totalRowsCleared += rowsBefore;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (logger != null) {
            logger.error(LogSource.DATABASE, `Failed to clear ${table.name}: ${errorMessage}`);
          }
          failedTables.push(table.name);
        }
      }
    });

    return {
      clearedCount,
      failedTables,
      totalRowsCleared
    };
  }

  /**
   * Run database optimization (VACUUM).
   * @param logger - Logger instance.
   */
  public async optimizeDatabase(logger?: ILogger): Promise<void> {
    try {
      if (logger != null) {
        logger.info(LogSource.DATABASE, '');
        logger.info(LogSource.DATABASE, 'Running VACUUM to reclaim disk space...');
      }
      await this.databaseService.execute('VACUUM');
      if (logger != null) {
        logger.info(LogSource.DATABASE, 'Database optimized');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (logger != null) {
        logger.warn(LogSource.DATABASE, `Warning: VACUUM failed: ${errorMessage}`);
      }
    }
  }
}
