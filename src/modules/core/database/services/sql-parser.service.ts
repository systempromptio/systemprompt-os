/**
 * SQL Parser Service for safe schema execution.
 * @file SQL parser service for statement validation and parsing.
 * @module database/services/sql-parser
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IParseResult, IParsedStatement } from '@/modules/core/database/types/sql-parser.types';
import { ZERO } from '@/modules/core/database/constants/index';

/**
 * SQL parser service for parsing and validating SQL statements.
 */
export class SQLParserService {
  private static instance: SQLParserService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Creates a new SQL parser service instance.
   */
  private constructor() {}

  /**
   * Initialize the SQL parser service.
   * @param logger - Optional logger instance.
   * @returns The initialized SQL parser service instance.
   */
  public static initialize(logger?: ILogger): SQLParserService {
    SQLParserService.instance ||= new SQLParserService();
    if (logger !== undefined) {
      SQLParserService.instance.logger = logger;
    }
    SQLParserService.instance.initialized = true;
    return SQLParserService.instance;
  }

  /**
   * Get the SQL parser service instance.
   * @returns The SQL parser service instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): SQLParserService {
    if (!SQLParserService.instance || !SQLParserService.instance.initialized) {
      throw new Error('SQLParserService not initialized. Call initialize() first.');
    }
    return SQLParserService.instance;
  }

  /**
   * Parse SQL file into individual statements.
   * @param sql - SQL content to parse.
   * @param fileName - Optional file name for logging.
   * @returns Parse result with statements and errors.
   */
  public parseSQLFile(sql: string, fileName?: string): IParseResult {
    if (fileName !== undefined) {
      this.logger?.debug(LogSource.DATABASE, 'Parsing SQL file', { fileName });
    }

    const lines = sql.split('\n');
    const statements: IParsedStatement[] = [];
    const errors: Array<{ line: number; message: string }> = [];

    let currentStatement = '';
    let statementStartLine = ZERO;
    let inComment = false;
    let inString = false;
    let stringChar = '';
    let inTrigger = false;
    let triggerBeginCount = ZERO;

    for (let lineIndex = ZERO; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (line === undefined) { continue; }
      const trimmedLine = line.trim();

      if (!trimmedLine && !currentStatement) {
        continue;
      }

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

      if (trimmedLine.startsWith('--')) {
        continue;
      }

      if (!currentStatement && trimmedLine) {
        statementStartLine = lineIndex + 1;
      }

      if (trimmedLine.toUpperCase().startsWith('CREATE TRIGGER')) {
        inTrigger = true;
        triggerBeginCount = ZERO;
      }

      if (inTrigger) {
        const upperLine = trimmedLine.toUpperCase();
        if (upperLine === 'BEGIN') {
          triggerBeginCount++;
        } else if (upperLine.startsWith('END;') || upperLine === 'END') {
          triggerBeginCount--;
          if (triggerBeginCount === ZERO) {
            inTrigger = false;
          }
        }
      }

      let charIndex = ZERO;
      for (charIndex = ZERO; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        const prevChar = charIndex > ZERO ? line[charIndex - 1] : '';

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

        if (char === ';' && !inString) {
          const parsed = this.parseStatement(currentStatement.trim(), statementStartLine);

          if (!parsed.isValid && parsed.error !== undefined) {
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

      if (currentStatement && charIndex === line.length) {
        currentStatement += '\n';
      }
    }

    if (currentStatement.trim()) {
      const parsed = this.parseStatement(currentStatement.trim(), statementStartLine);
      if (!parsed.isValid && parsed.error !== undefined) {
        errors.push({
          line: statementStartLine,
          message: parsed.error
        });
      }
      statements.push(parsed);
    }

    return {
      statements,
      hasErrors: errors.length > ZERO,
      errors
    };
  }

  /**
   * Parse and validate a single SQL statement.
   * @param statement - SQL statement to parse.
   * @param lineNumber - Line number where statement starts.
   * @returns Parsed statement with validation result.
   */
  private parseStatement(statement: string, lineNumber: number): IParsedStatement {
    const normalized = statement.replace(/\s+/g, ' ').trim();
    const upperStatement = normalized.toUpperCase();

    let type: IParsedStatement['type'] = 'DDL';
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

    const validation = this.validateStatement(statement, type);

    if (validation.error !== undefined) {
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
   * @param statement - Statement to validate.
   * @param type - Statement type.
   * @returns Validation result with optional error message.
   */
  private validateStatement(statement: string, type: IParsedStatement['type']): { isValid: boolean; error?: string } {
    const openParenMatches = statement.match(/\(/g);
    const closeParenMatches = statement.match(/\)/g);
    const openParens = openParenMatches?.length ?? ZERO;
    const closeParens = closeParenMatches?.length ?? ZERO;

    if (openParens !== closeParens) {
      return {
        isValid: false,
        error: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`
      };
    }

    const singleQuotes = statement.split("'").length - 1;
    const doubleQuotes = statement.split('"').length - 1;
    const TWO = 2;

    if (singleQuotes % TWO !== ZERO) {
      return {
        isValid: false,
        error: 'Unclosed single quote'
      };
    }

    if (doubleQuotes % TWO !== ZERO) {
      return {
        isValid: false,
        error: 'Unclosed double quote'
      };
    }

    if (type === 'DDL') {
      const upperStatement = statement.toUpperCase();

      if (upperStatement.includes('DROP TABLE') && !upperStatement.includes('IF EXISTS')) {
        return {
          isValid: false,
          error: 'DROP TABLE should use IF EXISTS for safety'
        };
      }

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
   * @param statements - Array of parsed statements.
   * @returns Categorized statements by type.
   */
  public categorizeStatements(statements: IParsedStatement[]): {
    tables: IParsedStatement[];
    indexes: IParsedStatement[];
    triggers: IParsedStatement[];
    data: IParsedStatement[];
    other: IParsedStatement[];
  } {
    const categorized = {
      tables: [] as IParsedStatement[],
      indexes: [] as IParsedStatement[],
      triggers: [] as IParsedStatement[],
      data: [] as IParsedStatement[],
      other: [] as IParsedStatement[]
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
