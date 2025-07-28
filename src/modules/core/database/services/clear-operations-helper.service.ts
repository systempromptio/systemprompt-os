import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Helper service for database clear operations.
 */
export class ClearOperationsHelperService {
  /**
   * Clear tables with transaction support.
   * @param tables - Array of table names.
   * @param logger - Logger instance.
   * @returns Clear operation result.
   */
  static async clearTables(
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
    const dbService = DatabaseService.getInstance();

    await dbService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
      for (const table of tables) {
        try {
          const beforeCount = await conn.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM \`${table.name}\``
          );
          const rowsBefore = beforeCount.rows[0]?.count ?? 0;

          await conn.execute(`DELETE FROM \`${table.name}\``);

          if (logger) {
            logger.info(
              LogSource.DATABASE,
              `Cleared ${table.name} (${rowsBefore.toLocaleString()} rows deleted)`
            );
          }
          clearedCount += 1;
          totalRowsCleared += rowsBefore;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (logger) {
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
  static async optimizeDatabase(logger?: ILogger): Promise<void> {
    try {
      if (logger) {
        logger.info(LogSource.DATABASE, '');
        logger.info(LogSource.DATABASE, 'Running VACUUM to reclaim disk space...');
      }
      const dbService = DatabaseService.getInstance();
      await dbService.execute('VACUUM');
      if (logger) {
        logger.info(LogSource.DATABASE, 'Database optimized');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (logger) {
        logger.warn(LogSource.DATABASE, `Warning: VACUUM failed: ${errorMessage}`);
      }
    }
  }
}
