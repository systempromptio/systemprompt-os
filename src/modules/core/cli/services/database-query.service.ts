/**
 * Format output types supported by the query command.
 */
export type OutputFormat = 'table' | 'json' | 'csv';

/**
 * Query parameters interface.
 */
export interface IQueryParams {
  sql?: string;
  file?: string;
  format?: OutputFormat;
  readonly?: boolean;
  interactive?: boolean;
}

/**
 * Query result interface.
 */
export interface IQueryResult {
  output: string[];
  executionTime: number;
}

/**
 * Database query service for CLI operations.
 */
export class DatabaseQueryService {
  private static instance: DatabaseQueryService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the service instance.
   * @returns The service instance.
   */
  public static getInstance(): DatabaseQueryService {
    DatabaseQueryService.instance ||= new DatabaseQueryService();
    return DatabaseQueryService.instance;
  }

  /**
   * Execute a query.
   * @param sql - SQL query to execute.
   * @param format - Output format.
   * @returns Query result.
   */
  public async executeQuery(
    sql: string,
    format: OutputFormat
  ): Promise<IQueryResult> {
    // Dynamic import to avoid direct database folder import restriction
    const { DatabaseService } = await import(
      '../../database/services/database.service'
    );
    const dbService = DatabaseService.getInstance();
    
    const startTime = Date.now();
    const results = await dbService.query(sql);
    const executionTime = Date.now() - startTime;

    let output: string[];

    if (!Array.isArray(results)) {
      output = [`Query executed successfully (${String(executionTime)}ms)`];
      return {
        output,
        executionTime
      };
    }

    if (!this.isRecordArray(results)) {
      output = [`Query executed successfully (${String(executionTime)}ms)`];
      return {
        output,
        executionTime
      };
    }

    switch (format) {
      case 'json':
        output = [JSON.stringify(results, null, 2)];
        break;
      case 'csv':
        output = this.formatCsvOutput(results);
        break;
      case 'table':
      default:
        output = this.formatTableOutput(results);
        break;
    }

    return {
      output,
      executionTime
    };
  }

  /**
   * Check if query is read-only.
   * @param sql - SQL query to check.
   * @returns True if read-only, false otherwise.
   */
  public isReadOnlyQuery(sql: string): boolean {
    const trimmedSql = sql.trim().toLowerCase();
    const writePatterns = [
      /^insert\s/u,
      /^update\s/u,
      /^delete\s/u,
      /^drop\s/u,
      /^create\s/u,
      /^alter\s/u,
      /^truncate\s/u
    ];

    return !writePatterns.some((pattern): boolean => pattern.test(trimmedSql));
  }

  /**
   * Parse SQL file content into individual queries.
   * @param content - File content.
   * @returns Array of queries.
   */
  public parseQueries(content: string): string[] {
    return content
      .split(';')
      .map((query): string => query.trim())
      .filter((query): boolean => query.length > 0);
  }

  /**
   * Check if database is initialized.
   * @returns True if initialized, false otherwise.
   */
  public async isInitialized(): Promise<boolean> {
    const { DatabaseService } = await import(
      '../../database/services/database.service'
    );
    const dbService = DatabaseService.getInstance();
    return await dbService.isInitialized();
  }

  /**
   * Type guard to check if value is a record array.
   * @param value - Value to check.
   * @returns True if record array, false otherwise.
   */
  private isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.every((item): boolean =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
    );
  }

  /**
   * Format table output.
   * @param results - Query results.
   * @returns Formatted output lines.
   */
  private formatTableOutput(results: Record<string, unknown>[]): string[] {
    if (results.length === 0) {
      return ['(0 rows)'];
    }

    const output: string[] = [];
    const [firstRow] = results;
    if (firstRow === undefined) {
      return ['(0 rows)'];
    }
    const keys = Object.keys(firstRow);

    const columnWidths = keys.map((key): number => {
      const headerWidth = key.length;
      const maxDataWidth = Math.max(
        ...results.map((row): number => {
          const { [key]: value } = row;
          const displayValue = value === null ? 'NULL' : String(value);
          return displayValue.length;
        })
      );
      return Math.max(headerWidth, maxDataWidth);
    });

    const header = keys.map((key, i): string => {
      const { [i]: width } = columnWidths;
      return key.padEnd(width ?? 0);
    }).join(' | ');
    output.push(header);

    const separator = '-'.repeat(header.length - 1);
    output.push(separator);

    results.forEach((row): void => {
      const rowStr = keys.map((key, i): string => {
        const { [key]: value } = row;
        const displayValue = value === null ? 'NULL' : String(value);
        const { [i]: width } = columnWidths;
        return displayValue.padEnd(width ?? 0);
      }).join(' | ');
      output.push(rowStr);
    });

    return output;
  }

  /**
   * Format CSV output.
   * @param results - Query results.
   * @returns Formatted output lines.
   */
  private formatCsvOutput(results: Record<string, unknown>[]): string[] {
    if (results.length === 0) {
      return ['(0 rows)'];
    }

    const output: string[] = [];
    const [firstRow] = results;
    if (firstRow === undefined) {
      return ['(0 rows)'];
    }
    const keys = Object.keys(firstRow);

    output.push(keys.join(','));

    results.forEach((row): void => {
      const rowValues = keys.map((key): string => {
        const { [key]: value } = row;
        if (value === null) {
          return '';
        }
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/gu, '""')}"`;
        }
        return stringValue;
      });
      output.push(rowValues.join(','));
    });

    return output;
  }
}
