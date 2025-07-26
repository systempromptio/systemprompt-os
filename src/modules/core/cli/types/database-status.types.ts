/**
 * Format for status output.
 */
export type StatusFormat = 'text' | 'json';

/**
 * Database status data interface.
 */
export interface IStatusData {
  connected: boolean;
  initialized: boolean;
  type: string;
  timestamp: string;
  tableCount?: number;
  tables?: string[];
  schemaVersions?: Array<{
    module: string;
    version: string;
  }>;
  error?: string;
}

/**
 * Schema version interface.
 */
export interface ISchemaVersion {
  module: string;
  version: string;
}
