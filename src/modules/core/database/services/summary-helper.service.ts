import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Helper service for database summary operations.
 */
export class SummaryHelperService {
  /**
   * Get list of all tables in the database.
   * @param includeSystem - Include system tables in the list.
   * @returns Array of table names.
   */
  static async getTables(includeSystem: boolean = false): Promise<Array<{ name: string }>> {
    const dbService = DatabaseService.getInstance();
    let tableQuery = "SELECT name FROM sqlite_master WHERE type='table'";
    if (!includeSystem) {
      tableQuery += " AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'";
    }
    tableQuery += ' ORDER BY name';
    return await dbService.query<{ name: string }>(tableQuery);
  }

  /**
   * Get detailed information about a table.
   * @param tableName - Name of the table.
   * @returns Table information including row count and columns.
   */
  static async getTableInfo(tableName: string): Promise<{
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
    const dbService = DatabaseService.getInstance();

    const rowCountResult = await dbService.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
    const rowCount = rowCountResult[0]?.count ?? 0;

    const columns = await dbService.query<{
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
  static sortTableInfos(
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
    sortBy: 'name' | 'rows' | 'columns' = 'name'
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
    return tableInfos.sort((tableA, tableB): number => {
      switch (sortBy) {
        case 'rows':
          return tableB.rowCount - tableA.rowCount;
        case 'columns':
          return tableB.columnCount - tableA.columnCount;
        case 'name':
        default:
          return tableA.name.localeCompare(tableB.name);
      }
    });
  }

  /**
   * Calculate summary statistics for the database.
   * @param tableInfos - Array of table information.
   * @returns Summary statistics.
   */
  static calculateSummaryStats(
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
    }>
  ): {
    totalTables: number;
    totalRows: number;
    averageRowsPerTable: number;
  } {
    const totalRows = tableInfos.reduce((sum, table) => { return sum + table.rowCount }, 0);

    return {
      totalTables: tableInfos.length,
      totalRows,
      averageRowsPerTable: tableInfos.length > 0 ? Math.round(totalRows / tableInfos.length) : 0,
    };
  }
}
