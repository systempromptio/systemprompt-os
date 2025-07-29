/**
 * Detailed table information structure for database summaries.
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
 * Summary result structure for database operations.
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
 * Summary statistics calculation result.
 */
export interface ISummaryStats {
  totalTables: number;
  totalRows: number;
  averageRowsPerTable: number;
}

/**
 * Database connection interface for summary operations.
 */
export interface IDatabaseConnectionForSummary {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
