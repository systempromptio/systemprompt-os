/**
 * Schema file definition.
 */
export interface ISchemaFile {
  module: string;
  filepath: string;
  checksum: string;
  content: string;
}

/**
 * Import result.
 */
export interface IImportResult {
  success: boolean;
  imported: string[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
}
