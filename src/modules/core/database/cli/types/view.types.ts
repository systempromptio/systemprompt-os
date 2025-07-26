/**
 * Supported output formats for view command.
 */
export type ViewFormat = 'table' | 'json' | 'csv';

/**
 * View command arguments interface.
 */
export interface IViewArgs {
  table?: string;
  format?: ViewFormat;
  limit?: number | string;
  offset?: number | string;
  columns?: string;
  where?: string;
  orderBy?: string;
  schemaOnly?: boolean;
}

/**
 * Column information interface.
 */
export interface IColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

/**
 * Table information interface for database summary.
 */
export interface ITableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: Array<{ name: string; type: string; nullable: boolean; primaryKey: boolean }>;
}

/**
 * Database summary interface.
 */
export interface IDatabaseSummary {
  totalTables: number;
  totalRows: number;
  averageRowsPerTable: number;
  tables: ITableInfo[];
  timestamp: string;
}

/**
 * Summary output format type.
 */
export type SummaryFormat = 'text' | 'json' | 'table';

/**
 * Summary sort by type.
 */
export type SummarySortBy = 'name' | 'rows' | 'columns';

/**
 * Summary format for CLI output.
 */
export type ISummaryFormatCLI = 'text' | 'json' | 'table';

/**
 * Summary sort criteria for CLI.
 */
export type ISummarySortByCLI = 'name' | 'rows' | 'columns';
