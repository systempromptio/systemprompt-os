/**
 * SQL Parser Service for safe schema execution.
 * Provides:
 * - SQL statement parsing and validation
 * - Safe execution with proper error handling
 * - Transaction management
 * - Detailed error reporting.
 */

import type { ILogger } from '@/modules/core/logger/types/index.js';

export interface ParsedStatement {
  type: 'DDL' | 'DML' | 'COMMENT' | 'TRANSACTION';
  statement: string;
  normalized: string;
  lineNumber: number;
  isValid: boolean;
  error?: string;
}

export interface ParseResult {
  statements: ParsedStatement[];
  hasErrors: boolean;
  errors: Array<{ line: number; message: string }>;
}

export class SQLParserService {
  constructor(
    // @ts-expect-error - Will be used for logging when implemented
    private readonly _logger?: ILogger
  ) {}

  /**
   * Parse SQL file into individual statements.
   * @param sql
   * @param _fileName
   */
  parseSQLFile(sql: string, _fileName?: string): ParseResult {
    const lines = sql.split('\n');
    const statements: ParsedStatement[] = [];
    const errors: Array<{ line: number; message: string }> = [];

    let currentStatement = '';
    let statementStartLine = 0;
    let inComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) { continue; }
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine && !currentStatement) {
        continue;
      }

      // Handle multi-line comments
      if (trimmedLine.startsWith('/*')) {
        inComment = true;
      }
      if (inComment && trimmedLine.endsWith('*/')) {
        inComment = false;
        continue;
      }
      if (inComment) {
        continue;
      }

      // Handle single-line comments
      if (trimmedLine.startsWith('--')) {
        continue;
      }

      // Track statement start
      if (!currentStatement && trimmedLine) {
        statementStartLine = i + 1;
      }

      // Parse the line character by character to handle strings properly
      let j = 0;
      for (j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';

        // Handle string literals
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }

        currentStatement += char;

        // Check for statement end (semicolon outside of string)
        if (char === ';' && !inString) {
          const parsed = this.parseStatement(currentStatement.trim(), statementStartLine);

          if (!parsed.isValid && parsed.error) {
            errors.push({
 line: statementStartLine,
message: parsed.error
});
          }

          statements.push(parsed);
          currentStatement = '';
          break;
        }
      }

      if (currentStatement && j === line.length) {
        currentStatement += '\n';
      }
    }

    // Handle any remaining statement
    if (currentStatement.trim()) {
      const parsed = this.parseStatement(currentStatement.trim(), statementStartLine);
      if (!parsed.isValid && parsed.error) {
        errors.push({
 line: statementStartLine,
message: parsed.error
});
      }
      statements.push(parsed);
    }

    return {
      statements,
      hasErrors: errors.length > 0,
      errors
    };
  }

  /**
   * Parse and validate a single SQL statement.
   * @param statement
   * @param lineNumber
   */
  private parseStatement(statement: string, lineNumber: number): ParsedStatement {
    const normalized = statement.replace(/\s+/g, ' ').trim();
    const upperStatement = normalized.toUpperCase();

    // Determine statement type
    let type: ParsedStatement['type'] = 'DDL';
    if (upperStatement.startsWith('INSERT')
        || upperStatement.startsWith('UPDATE')
        || upperStatement.startsWith('DELETE')
        || upperStatement.startsWith('SELECT')) {
      type = 'DML';
    } else if (upperStatement.startsWith('BEGIN')
               || upperStatement.startsWith('COMMIT')
               || upperStatement.startsWith('ROLLBACK')) {
      type = 'TRANSACTION';
    } else if (upperStatement.startsWith('--')
               || upperStatement.startsWith('/*')) {
      type = 'COMMENT';
    }

    // Basic validation
    const validation = this.validateStatement(statement, type);

    if (validation.error) {
      return {
        type,
        statement,
        normalized,
        lineNumber,
        isValid: validation.isValid,
        error: validation.error
      };
    }

    return {
      type,
      statement,
      normalized,
      lineNumber,
      isValid: validation.isValid
    };
  }

  /**
   * Validate SQL statement syntax.
   * @param statement
   * @param type
   */
  private validateStatement(statement: string, type: ParsedStatement['type']): { isValid: boolean; error?: string } {
    // Check for common syntax errors
    const openParens = (statement.match(/\(/g) || []).length;
    const closeParens = (statement.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      return {
 isValid: false,
error: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`
};
    }

    // Check for unclosed strings
    const singleQuotes = statement.split("'").length - 1;
    const doubleQuotes = statement.split('"').length - 1;

    if (singleQuotes % 2 !== 0) {
      return {
 isValid: false,
error: 'Unclosed single quote'
};
    }

    if (doubleQuotes % 2 !== 0) {
      return {
 isValid: false,
error: 'Unclosed double quote'
};
    }

    // DDL-specific validation
    if (type === 'DDL') {
      const upperStatement = statement.toUpperCase();

      // Check for dangerous operations
      if (upperStatement.includes('DROP TABLE') && !upperStatement.includes('IF EXISTS')) {
        return {
 isValid: false,
error: 'DROP TABLE should use IF EXISTS for safety'
};
      }

      // Validate CREATE TABLE syntax
      if (upperStatement.startsWith('CREATE TABLE')) {
        if (!statement.includes('(')) {
          return {
 isValid: false,
error: 'CREATE TABLE missing column definitions'
};
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Split SQL by statement type for ordered execution.
   * @param statements
   */
  categorizeStatements(statements: ParsedStatement[]): {
    tables: ParsedStatement[];
    indexes: ParsedStatement[];
    triggers: ParsedStatement[];
    data: ParsedStatement[];
    other: ParsedStatement[];
  } {
    const categorized = {
      tables: [] as ParsedStatement[],
      indexes: [] as ParsedStatement[],
      triggers: [] as ParsedStatement[],
      data: [] as ParsedStatement[],
      other: [] as ParsedStatement[]
    };

    for (const stmt of statements) {
      const upper = stmt.normalized.toUpperCase();

      if (upper.startsWith('CREATE TABLE')) {
        categorized.tables.push(stmt);
      } else if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) {
        categorized.indexes.push(stmt);
      } else if (upper.startsWith('CREATE TRIGGER')) {
        categorized.triggers.push(stmt);
      } else if (stmt.type === 'DML') {
        categorized.data.push(stmt);
      } else {
        categorized.other.push(stmt);
      }
    }

    return categorized;
  }
}
