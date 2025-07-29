/**
 * Database summary repository for data access operations.
 * @file Database summary repository for managing summary data access.
 * @module modules/core/database/repositories/summary.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ISummaryStats, ITableInfo } from '@/modules/core/database/types/summary.types';

/**
 * Summary repository for database operations.
 */
export class SummaryRepository {
  /**
   * Constructor for SummaryRepository.
   * @param database - Database service instance.
   */
  constructor(private readonly database: DatabaseService) {}

  /**
   * Get list of all tables in the database.
   * @param includeSystem - Include system tables in the list.
   * @returns Promise resolving to array of table names.
   */
  async getTables(includeSystem: boolean = false): Promise<Array<{ name: string }>> {
    let tableQuery = "SELECT name FROM sqlite_master WHERE type='table'";
    if (!includeSystem) {
      tableQuery += " AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'";
    }
    tableQuery += ' ORDER BY name';
    return await this.database.query<{ name: string }>(tableQuery);
  }

  /**
   * Get detailed information about a table.
   * @param tableName - Name of the table.
   * @returns Promise resolving to table information including row count and columns.
   */
  async getTableInfo(tableName: string): Promise<ITableInfo> {
    const rowCountResult = await this.database.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
    const rowCount = rowCountResult[0]?.count ?? 0;

    const columns = await this.database.query<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(`PRAGMA table_info(\`${tableName}\`)`);

    const columnInfo = columns.map(col => { return {
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      primaryKey: col.pk > 0,
    } });

    return {
      name: tableName,
      rowCount,
      columnCount: columns.length,
      columns: columnInfo,
    };
  }

  /**
   * Sort table information based on specified criteria.
   * @param tableInfos - Array of table information.
   * @param sortBy - Sort criteria (name, rows, or columns).
   * @returns Sorted array of table information.
   */
  sortTableInfos(
    tableInfos: ITableInfo[],
    sortBy: 'name' | 'rows' | 'columns' = 'name'
  ): ITableInfo[] {
    return tableInfos.sort((tableA, tableB): number => {
      switch (sortBy) {
        case 'rows': {
          return tableB.rowCount - tableA.rowCount;
        }
        case 'columns': {
          return tableB.columnCount - tableA.columnCount;
        }
        case 'name':
        default: {
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
  calculateSummaryStats(tableInfos: ITableInfo[]): ISummaryStats {
    const totalRows = tableInfos.reduce((sum, table) => { return sum + table.rowCount }, 0);

    return {
      totalTables: tableInfos.length,
      totalRows,
      averageRowsPerTable: tableInfos.length > 0 ? Math.round(totalRows / tableInfos.length) : 0,
    };
  }
}
