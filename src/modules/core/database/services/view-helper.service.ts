import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Helper service for database view operations.
 */
export class ViewHelperService {
  /**
   * Get table schema information.
   * @param tableName - Name of the table.
   * @returns Column information.
   */
  static async getTableSchema(tableName: string): Promise<Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue: string | null;
  }>> {
    const dbService = DatabaseService.getInstance();
    const schema = await dbService.query<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA table_info(\`${tableName}\`)`);

    return schema.map(col => { return {
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      primaryKey: col.pk > 0,
      defaultValue: col.dflt_value,
    } });
  }

  /**
   * Validate columns against table schema.
   * @param columns - Comma-separated column names.
   * @param columnInfo - Column information from schema.
   * @returns Array of validated column names.
   * @throws Error if invalid columns are requested.
   */
  static validateColumns(columns: string, columnInfo: Array<{ name: string }>): string[] {
    const requestedColumns = columns.split(',').map(col => { return col.trim() });
    const validColumns = columnInfo.map(col => { return col.name });
    const invalidColumns = requestedColumns.filter(
      col => { return !validColumns.includes(col) }
    );

    if (invalidColumns.length > 0) {
      throw new Error(`Invalid columns: ${invalidColumns.join(', ')}`);
    }

    return requestedColumns;
  }

  /**
   * Build select query for view command.
   * @param params - View parameters.
   * @param params.tableName - Name of the table.
   * @param params.columns - Comma-separated column names.
   * @param params.where - SQL WHERE clause.
   * @param params.orderBy - SQL ORDER BY clause.
   * @param params.limit - Maximum rows to return.
   * @param params.offset - Number of rows to skip.
   * @param columnInfo - Column information.
   * @returns Query and parameters.
   */
  static buildViewQuery(params: {
    tableName: string;
    columns?: string;
    where?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }, columnInfo: Array<{ name: string }>): {
    query: string;
    queryParams: unknown[];
    selectColumns: string;
  } {
    let selectColumns = '*';

    if (params.columns !== undefined) {
      const validatedColumns = ViewHelperService.validateColumns(params.columns, columnInfo);
      selectColumns = validatedColumns.map(col => { return `\`${col}\`` }).join(', ');
    }

    let query = `SELECT ${selectColumns} FROM \`${params.tableName}\``;
    const queryParams: unknown[] = [];

    if (params.where !== undefined) {
      query += ` WHERE ${params.where}`;
    }

    if (params.orderBy !== undefined) {
      query += ` ORDER BY ${params.orderBy}`;
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    return {
      query,
      queryParams,
      selectColumns
    };
  }

  /**
   * Check if table exists in database.
   * @param tableName - Name of the table to check.
   * @returns True if table exists, false otherwise.
   */
  static async checkTableExists(tableName: string): Promise<boolean> {
    const dbService = DatabaseService.getInstance();
    const tableExists = await dbService.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return (tableExists[0]?.count ?? 0) > 0;
  }

  /**
   * Get total row count for a table with optional WHERE clause.
   * @param tableName - Name of the table.
   * @param whereClause - Optional WHERE clause.
   * @returns Total row count.
   */
  static async getRowCount(tableName: string, whereClause?: string): Promise<number> {
    const dbService = DatabaseService.getInstance();
    let countQuery = `SELECT COUNT(*) as count FROM \`${tableName}\``;
    if (whereClause !== undefined) {
      countQuery += ` WHERE ${whereClause}`;
    }
    const totalResult = await dbService.query<{ count: number }>(countQuery);
    return totalResult[0]?.count ?? 0;
  }
}
