import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';

/**
 * Helper service for logging operations.
 * Implements singleton pattern as required for core module services.
 */
export class LoggingHelperService {
  private static instance: LoggingHelperService | undefined;

  /**
   * Private constructor for singleton pattern.
   * Implementation intentionally empty.
   */
  private constructor() {
    Object.seal(this);
  }

  /**
   * Get the singleton instance of LoggingHelperService.
   * @returns The singleton instance.
   */
  public static getInstance(): LoggingHelperService {
    LoggingHelperService.instance ??= new LoggingHelperService();
    return LoggingHelperService.instance;
  }

  /**
   * Log rebuild warning messages.
   * @param allTables - Array of all tables.
   * @param logger - Logger instance.
   */
  public logRebuildWarning(allTables: Array<{ name: string }>, logger?: ILogger): void {
    if (logger === undefined) { return; }

    this.logRebuildHeader(logger);
    this.logRebuildSteps(logger);
    this.logTablesToDestroy(allTables, logger);
    this.logRebuildFooter(logger);
  }

  /**
   * Log rebuild complete messages.
   * @param finalTables - Array of final tables.
   * @param logger - Logger instance.
   */
  public logRebuildComplete(finalTables: Array<{ name: string }>, logger?: ILogger): void {
    if (logger === undefined) { return; }

    logger.info(LogSource.DATABASE, 'Database Rebuild Complete!');
    logger.info(LogSource.DATABASE, '=============================');
    logger.info(
      LogSource.DATABASE,
      `Database now contains ${finalTables.length.toString()} tables:`
    );
    for (const table of finalTables) {
      logger.info(LogSource.DATABASE, `  - ${table.name}`);
    }
  }

  /**
   * Log clear warning messages.
   * @param tables - Array of tables to clear.
   * @param logger - Logger instance.
   */
  public logClearWarning(tables: Array<{ name: string }>, logger?: ILogger): void {
    if (logger === undefined) { return; }

    logger.warn(LogSource.DATABASE, 'WARNING: Database Clear Operation');
    logger.warn(LogSource.DATABASE, '=====================================');
    logger.warn(LogSource.DATABASE, 'This will DELETE ALL DATA from the following tables:');
    logger.warn(LogSource.DATABASE, '');

    for (const table of tables) {
      logger.warn(LogSource.DATABASE, `  - ${table.name}`);
    }

    logger.warn(LogSource.DATABASE, '');
    logger.warn(
      LogSource.DATABASE,
      'The table schemas will be preserved, but ALL DATA WILL BE LOST.'
    );
    logger.warn(LogSource.DATABASE, 'This operation CANNOT be undone.');
    logger.warn(LogSource.DATABASE, '');
  }

  /**
   * Log clear operation complete messages.
   * @param result - Clear operation result.
   * @param result.clearedCount - Number of tables successfully cleared.
   * @param result.failedTables - Array of table names that failed to clear.
   * @param result.totalRowsCleared - Total number of rows cleared across all tables.
   * @param logger - Logger instance.
   */
  public logClearComplete(
    result: {
      clearedCount: number;
      failedTables: string[];
      totalRowsCleared: number;
    },
    logger?: ILogger
  ): void {
    if (logger === undefined) { return; }

    logger.info(LogSource.DATABASE, '');
    logger.info(LogSource.DATABASE, 'Clear Operation Complete');
    logger.info(LogSource.DATABASE, '========================');
    logger.info(
      LogSource.DATABASE,
      `Successfully cleared: ${result.clearedCount.toString()} tables`
    );
    logger.info(
      LogSource.DATABASE,
      `Total rows deleted: ${result.totalRowsCleared.toLocaleString()}`
    );

    if (result.failedTables.length > 0) {
      logger.info(
        LogSource.DATABASE,
        `Failed to clear: ${result.failedTables.length.toString()} tables`
      );
      logger.info(LogSource.DATABASE, 'Failed tables:');
      for (const table of result.failedTables) {
        logger.info(LogSource.DATABASE, `  - ${table}`);
      }
    }
  }

  /**
   * Log rebuild operation header.
   * @param logger - Logger instance.
   */
  private logRebuildHeader(logger: ILogger): void {
    logger.warn(LogSource.DATABASE, 'DANGER: Database Rebuild Operation');
    logger.warn(LogSource.DATABASE, '=====================================');
    logger.warn(
      LogSource.DATABASE,
      'This will COMPLETELY DESTROY AND RECREATE the entire database:'
    );
    logger.warn(LogSource.DATABASE, '');
  }

  /**
   * Log rebuild operation steps.
   * @param logger - Logger instance.
   */
  private logRebuildSteps(logger: ILogger): void {
    logger.warn(LogSource.DATABASE, '1. DROP all existing tables and data');
    logger.warn(LogSource.DATABASE, '2. Scan for schema files in all modules');
    logger.warn(LogSource.DATABASE, '3. Recreate database from schema files');
    logger.warn(LogSource.DATABASE, '');
  }

  /**
   * Log tables that will be destroyed.
   * @param allTables - Array of all tables.
   * @param logger - Logger instance.
   */
  private logTablesToDestroy(allTables: Array<{ name: string }>, logger: ILogger): void {
    if (allTables.length > 0) {
      logger.warn(
        LogSource.DATABASE,
        `Tables that will be DESTROYED (${allTables.length.toString()} total):`
      );
      for (const table of allTables) {
        logger.warn(LogSource.DATABASE, `  - ${table.name}`);
      }
      logger.warn(LogSource.DATABASE, '');
    }
  }

  /**
   * Log rebuild operation footer warnings.
   * @param logger - Logger instance.
   */
  private logRebuildFooter(logger: ILogger): void {
    logger.warn(LogSource.DATABASE, 'ALL DATA WILL BE PERMANENTLY LOST');
    logger.warn(LogSource.DATABASE, 'THIS OPERATION CANNOT BE UNDONE');
    logger.warn(LogSource.DATABASE, 'MAKE SURE YOU HAVE BACKUPS');
    logger.warn(LogSource.DATABASE, '');
  }
}
