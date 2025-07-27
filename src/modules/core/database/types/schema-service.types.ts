/**
 * MCP content scanner interface.
 */
export interface IMCPContentScanner {
  scanModule(moduleName: string, modulePath: string): Promise<void>;
  removeModuleContent(moduleName: string): Promise<void>;
}

/**
 * Import service interface.
 */
export interface IImportService {
  initialize(): Promise<void>;
  importSchemas(schemaFiles: Array<{
    module: string;
    filepath: string;
    checksum: string;
    content: string;
  }>): Promise<{
    success: boolean;
    imported: string[];
    skipped: string[];
    errors: Array<{ file: string; error: string }>;
  }>;
  getImportedSchemas(): Promise<Array<{
    module: string;
    filepath: string;
    checksum: string;
    imported_at: string;
  }>>;
}
