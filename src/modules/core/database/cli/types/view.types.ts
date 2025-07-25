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
