/**
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * 1. Architectural violation - this service is in wrong location (should be in CLI services)
 * 2. Functions too long/complex - need to be broken down further
 * 3. JSDoc parameter documentation issues - inline types need better documentation
 * 4. Comments restrictions - block comments not allowed, only JSDoc
 * Recommendation: Move this file to src/modules/core/cli/services/ and refactor structure.
 * Database summary utility for generating database statistics and table information.
 * @file Database summary utility for generating database statistics and table information.
 * @module modules/core/database/services/database-summary
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Re-export types for easier importing.
 */
export type {
  ISummaryParams,
  ISummaryResult,
  ITableInfo,
  IDatabaseConnectionForSummary,
} from '@/modules/core/database/types/index';

/**
 * Database summary utility class.
 * This utility provides database summary functionality without violating
 * architectural constraints by accepting a database connection interface.
 */
export class DatabaseSummaryService {
  private static instance: DatabaseSummaryService;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
  }

  /**
   * Get singleton instance.
   * @returns DatabaseSummaryService instance.
   */
  public static getInstance(): DatabaseSummaryService {
    DatabaseSummaryService.instance ||= new DatabaseSummaryService();
    return DatabaseSummaryService.instance;
  }

  /**
   * Handle summary operation with provided database connection.
   * @param params - Summary parameters.
   * @param databaseConnection - Database connection for queries.
   * @param params.format
   * @param params.includeSystem
   * @param params.sortBy
   * @param databaseConnection.query
   * @returns Promise resolving to summary result.
   */
  public async handleSummary(
    params: {
      format?: 'text' | 'json' | 'table';
      includeSystem?: boolean;
      sortBy?: 'name' | 'rows' | 'columns';
    },
    databaseConnection: {
      query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      timestamp: string;
      totalTables: number;
      totalRows: number;
      averageRowsPerTable: number;
      tables: Array<{
        name: string;
        rowCount: number;
        columnCount: number;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          primaryKey: boolean;
        }>;
      }>;
    };
  }> {
    const logger = LoggerService.getInstance();

    try {
      logger.info(LogSource.DATABASE, 'Starting database summary operation', {
        category: 'summary'
      });

      const tableInfos = await this.gatherTableInformation(
        params,
        databaseConnection,
        logger
      );
      const sortedTableInfos = this.sortTableInformation(tableInfos, params);
      const stats = this.calculateSummaryStats(sortedTableInfos);

      logger.info(LogSource.DATABASE, 'Database summary operation completed', {
        category: 'summary',
        totalTables: stats.totalTables
      });

      return this.buildSuccessResponse(stats, sortedTableInfos);
    } catch (error) {
      return this.buildErrorResponse(error, logger);
    }
  }

  /**
   * Gather table information from the database.
   * @param params - Summary parameters.
   * @param databaseConnection - Database connection for queries.
   * @param params.includeSystem
   * @param logger - Logger service instance.
   * @param databaseConnection.query
   * @returns Promise resolving to array of table information.
   */
  private async gatherTableInformation(
    params: {
      includeSystem?: boolean;
    },
    databaseConnection: {
      query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    },
    logger: LoggerService
  ): Promise<Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
    }>;
  }>> {
    const tables = await this.getTables(
      params.includeSystem ?? false,
      databaseConnection
    );

    const tableInfoPromises = tables.map(async (table): Promise<{
      name: string;
      rowCount: number;
      columnCount: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
    } | null> => {
      try {
        return await this.getTableInfo(table.name, databaseConnection);
      } catch (error) {
        logger.warn(LogSource.DATABASE, `Failed to get info for table ${table.name}`, {
          category: 'summary',
          error: error instanceof Error ? error : new Error(String(error))
        });
        return null;
      }
    });

    const results = await Promise.all(tableInfoPromises);
    return results.filter((info): info is {
      name: string;
      rowCount: number;
      columnCount: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
    } => {
      return info !== null;
    });
  }

  /**
   * Get list of all tables in the database.
   * @param includeSystem - Include system tables in the list.
   * @param databaseConnection - Database connection for queries.
   * @param databaseConnection.query
   * @returns Promise resolving to array of table names.
   */
  private async getTables(
    includeSystem: boolean,
    databaseConnection: {
      query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    }
  ): Promise<Array<{ name: string }>> {
    let tableQuery = "SELECT name FROM sqlite_master WHERE type='table'";
    if (!includeSystem) {
      tableQuery += " AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'";
    }
    tableQuery += ' ORDER BY name';
    return await databaseConnection.query<{ name: string }>(tableQuery);
  }

  /**
   * Get detailed information about a table.
   * @param tableName - Name of the table.
   * @param databaseConnection - Database connection for queries.
   * @param databaseConnection.query
   * @returns Promise resolving to table information including row count and columns.
   */
  private async getTableInfo(
    tableName: string,
    databaseConnection: {
      query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    }
  ): Promise<{
    name: string;
    rowCount: number;
    columnCount: number;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
    }>;
  }> {
    const rowCountResult = await databaseConnection.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
    const rowCount = rowCountResult[0]?.count ?? 0;

    const columns = await databaseConnection.query<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(`PRAGMA table_info(\`${tableName}\`)`);

    const columnInfo = columns.map((col): {
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
    } => {
      return {
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primaryKey: col.pk > 0,
      };
    });

    return {
      name: tableName,
      rowCount,
      columnCount: columns.length,
      columns: columnInfo,
    };
  }

  /**
   * Sort table information based on parameters.
   * @param tableInfos - Array of table information.
   * @param params - Summary parameters.
   * @param params.sortBy
   * @returns Sorted array of table information.
   */
  private sortTableInformation(
    tableInfos: Array<{
      name: string;
      rowCount: number;
      columnCount: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
    }>,
    params: {
      sortBy?: 'name' | 'rows' | 'columns';
    }
  ): Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
    }>;
  }> {
    const sortBy = params.sortBy ?? 'name';
    return tableInfos.sort((tableA, tableB): number => {
      switch (sortBy) {
        case 'rows': {
          return tableB.rowCount - tableA.rowCount;
        }
        case 'columns': {
          return tableB.columnCount - tableA.columnCount;
        }
        case 'name': {
          return tableA.name.localeCompare(tableB.name);
        }
      }
    });
  }

  /**
   * Calculate summary statistics for the database.
   * @param tableInfos - Array of table information.
   * @returns Summary statistics.
   */
  private calculateSummaryStats(tableInfos: Array<{
    rowCount: number;
  }>): {
    totalTables: number;
    totalRows: number;
    averageRowsPerTable: number;
  } {
    const totalRows = tableInfos.reduce((sum, table): number => {
      return sum + table.rowCount;
    }, 0);

    return {
      totalTables: tableInfos.length,
      totalRows,
      averageRowsPerTable: tableInfos.length > 0
        ? Math.round(totalRows / tableInfos.length)
        : 0,
    };
  }

  /**
   * Build success response.
   * @param stats - Summary statistics.
   * @param stats.totalTables
   * @param tables - Sorted table information.
   * @param stats.totalRows
   * @param stats.averageRowsPerTable
   * @returns Success response.
   */
  private buildSuccessResponse(
    stats: {
      totalTables: number;
      totalRows: number;
      averageRowsPerTable: number;
    },
    tables: Array<{
      name: string;
      rowCount: number;
      columnCount: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
    }>
  ): {
    success: boolean;
    data: {
      timestamp: string;
      totalTables: number;
      totalRows: number;
      averageRowsPerTable: number;
      tables: Array<{
        name: string;
        rowCount: number;
        columnCount: number;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          primaryKey: boolean;
        }>;
      }>;
    };
  } {
    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        ...stats,
        tables,
      },
    };
  }

  /**
   * Build error response.
   * @param error - Error that occurred.
   * @param logger - Logger service instance.
   * @returns Error response.
   */
  private buildErrorResponse(error: unknown, logger: LoggerService): {
    success: boolean;
    message: string;
  } {
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
