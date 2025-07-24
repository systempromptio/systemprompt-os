/**
 * Parsed SQL statement.
 */
export interface IParsedStatement {
  type: 'DDL' | 'DML' | 'COMMENT' | 'TRANSACTION';
  statement: string;
  normalized: string;
  lineNumber: number;
  isValid: boolean;
  error?: string;
}

/**
 * SQL parse result.
 */
export interface IParseResult {
  statements: IParsedStatement[];
  hasErrors: boolean;
  errors: Array<{ line: number; message: string }>;
}
