import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Helper service for logging operations.
 */
export class LoggingHelperService {
  /**
   * Log rebuild warning messages.
   * @param allTables - Array of all tables.
   * @param logger - Logger instance.
   */
  static logRebuildWarning(allTables: Array<{ name: string }>, logger?: ILogger): void {
    if (!logger) { return; }

    logger.warn(LogSource.DATABASE, 'DANGER: Database Rebuild Operation');
    logger.warn(LogSource.DATABASE, '=====================================');
    logger.warn(LogSource.DATABASE, 'This will COMPLETELY DESTROY AND RECREATE the entire database:');
    logger.warn(LogSource.DATABASE, '');
    logger.warn(LogSource.DATABASE, '1. DROP all existing tables and data');
    logger.warn(LogSource.DATABASE, '2. Scan for schema files in all modules');
    logger.warn(LogSource.DATABASE, '3. Recreate database from schema files');
    logger.warn(LogSource.DATABASE, '');

    if (allTables.length > 0) {
      logger.warn(LogSource.DATABASE, `Tables that will be DESTROYED (${allTables.length.toString()} total):`);
      for (const table of allTables) {
        logger.warn(LogSource.DATABASE, `  - ${table.name}`);
      }
      logger.warn(LogSource.DATABASE, '');
    }

    logger.warn(LogSource.DATABASE, 'ALL DATA WILL BE PERMANENTLY LOST');
    logger.warn(LogSource.DATABASE, 'THIS OPERATION CANNOT BE UNDONE');
    logger.warn(LogSource.DATABASE, 'MAKE SURE YOU HAVE BACKUPS');
    logger.warn(LogSource.DATABASE, '');
  }

  /**
   * Log rebuild complete messages.
   * @param finalTables - Array of final tables.
   * @param logger - Logger instance.
   */
  static logRebuildComplete(finalTables: Array<{ name: string }>, logger?: ILogger): void {
    if (!logger) { return; }

    logger.info(LogSource.DATABASE, 'Database Rebuild Complete!');
    logger.info(LogSource.DATABASE, '=============================');
    logger.info(LogSource.DATABASE, `Database now contains ${finalTables.length.toString()} tables:`);
    for (const table of finalTables) {
      logger.info(LogSource.DATABASE, `  - ${table.name}`);
    }
  }

  /**
   * Log clear warning messages.
   * @param tables - Array of tables to clear.
   * @param logger - Logger instance.
   */
  static logClearWarning(tables: Array<{ name: string }>, logger?: ILogger): void {
    if (!logger) { return; }

    logger.warn(LogSource.DATABASE, 'WARNING: Database Clear Operation');
    logger.warn(LogSource.DATABASE, '=====================================');
    logger.warn(LogSource.DATABASE, 'This will DELETE ALL DATA from the following tables:');
    logger.warn(LogSource.DATABASE, '');

    for (const table of tables) {
      logger.warn(LogSource.DATABASE, `  - ${table.name}`);
    }

    logger.warn(LogSource.DATABASE, '');
    logger.warn(LogSource.DATABASE, 'The table schemas will be preserved, but ALL DATA WILL BE LOST.');
    logger.warn(LogSource.DATABASE, 'This operation CANNOT be undone.');
    logger.warn(LogSource.DATABASE, '');
  }

  /**
   * Log clear operation complete messages.
   * @param result - Clear operation result.
   * @param result.clearedCount
   * @param logger - Logger instance.
   * @param result.failedTables
   * @param result.totalRowsCleared
   */
  static logClearComplete(
    result: {
      clearedCount: number;
      failedTables: string[];
      totalRowsCleared: number;
    },
    logger?: ILogger
  ): void {
    if (!logger) { return; }

    logger.info(LogSource.DATABASE, '');
    logger.info(LogSource.DATABASE, 'Clear Operation Complete');
    logger.info(LogSource.DATABASE, '========================');
    logger.info(LogSource.DATABASE, `Successfully cleared: ${result.clearedCount.toString()} tables`);
    logger.info(LogSource.DATABASE, `Total rows deleted: ${result.totalRowsCleared.toLocaleString()}`);

    if (result.failedTables.length > 0) {
      logger.info(LogSource.DATABASE, `Failed to clear: ${result.failedTables.length.toString()} tables`);
      logger.info(LogSource.DATABASE, 'Failed tables:');
      for (const table of result.failedTables) {
        logger.info(LogSource.DATABASE, `  - ${table}`);
      }
    }
  }
}
