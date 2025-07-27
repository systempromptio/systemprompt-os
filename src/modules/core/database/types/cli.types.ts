/**
 * Interface for table information from SQLite metadata.
 */
export interface ITableInfo {
  name: string;
}

/**
 * Interface for row count query results.
 */
export interface IRowCount {
  count: number;
}

/**
 * Valid actions for the schema command.
 */
export type SchemaAction = 'list' | 'init' | 'validate';
