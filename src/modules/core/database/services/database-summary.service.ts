/**
 * Database summary service for generating database statistics and table information.
 * @file Database summary service for generating database statistics and table information.
 * @module modules/core/database/services/database-summary
 */

import { SummaryHelperService } from '@/modules/core/database/services/summary-helper.service';
import { type ISummaryParams } from '@/modules/core/database/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// Re-export ISummaryParams for easier importing
export { type ISummaryParams } from '@/modules/core/database/types/index';

/**
 * Table information structure.
 */
export interface ITableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
  }>;
}

/**
 * Summary result structure.
 */
export interface ISummaryResult {
  success: boolean;
  message?: string;
  data?: {
    timestamp: string;
    totalTables: number;
    totalRows: number;
    averageRowsPerTable: number;
    tables: ITableInfo[];
  };
}

/**
 * Database summary service class.
 */
export class DatabaseSummaryService {
  private static instance: DatabaseSummaryService;

  /**
   * Get singleton instance.
   * @returns DatabaseSummaryService instance.
   */
  public static getInstance(): DatabaseSummaryService {
    DatabaseSummaryService.instance ||= new DatabaseSummaryService();
    return DatabaseSummaryService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Handle summary operation.
   * @param params - Summary parameters.
   * @returns Summary result.
   */
  public async handleSummary(params: ISummaryParams): Promise<ISummaryResult> {
    const logger = LoggerService.getInstance();

    try {
      logger.info(LogSource.DATABASE, 'Starting database summary operation', { category: 'summary' });

      const tables = await SummaryHelperService.getTables(params.includeSystem ?? false);

      const tableInfos: ITableInfo[] = [];
      for (const table of tables) {
        try {
          const tableInfo = await SummaryHelperService.getTableInfo(table.name);
          tableInfos.push(tableInfo);
        } catch (error) {
          logger.warn(LogSource.DATABASE, `Failed to get info for table ${table.name}`, {
            category: 'summary',
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }

      const sortBy = params.sortBy ?? 'name';
      const sortedTableInfos = SummaryHelperService.sortTableInfos(tableInfos, sortBy);

      const stats = SummaryHelperService.calculateSummaryStats(sortedTableInfos);

      logger.info(LogSource.DATABASE, 'Database summary operation completed', {
        category: 'summary',
        totalTables: stats.totalTables
      });

      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          ...stats,
          tables: sortedTableInfos,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.DATABASE, 'Database summary operation failed', {
        category: 'summary',
        error: error instanceof Error ? error : new Error(String(error))
      });

      return {
        success: false,
        message: errorMessage,
      };
    }
  }
}
