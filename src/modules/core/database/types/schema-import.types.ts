/**
 * SQL parser service interface.
 */
export interface ISQLParserService {
  parseSQLFile(content: string, filename: string): {
    hasErrors: boolean;
    errors: Array<{ line: number; message: string }>;
    statements: Array<{
      statement: string;
      lineNumber: number;
      isValid: boolean;
    }>;
  };
  categorizeStatements(statements: Array<{
    statement: string;
    lineNumber: number;
    isValid: boolean;
  }>): {
    tables: Array<{ statement: string; lineNumber: number; isValid: boolean }>;
    indexes: Array<{ statement: string; lineNumber: number; isValid: boolean }>;
    triggers: Array<{ statement: string; lineNumber: number; isValid: boolean }>;
    dataStatements: Array<{ statement: string; lineNumber: number; isValid: boolean }>;
    other: Array<{ statement: string; lineNumber: number; isValid: boolean }>;
  };
}

/**
 * Database service interface.
 */
export interface IDatabaseService {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (conn: {
    execute(sql: string, params?: unknown[]): Promise<void>;
    query<U>(sql: string, params?: unknown[]): Promise<U[]>;
  }) => Promise<T>): Promise<T>;
}

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
