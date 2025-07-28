import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Supported output formats for query results.
 */
export type OutputFormat = 'table' | 'json' | 'csv';

/**
 * Query execution result.
 */
export interface IQueryResult {
  output: string[];
  executionTime: number;
}

/**
 * Database Query Service - Handles safe execution of SQL queries.
 * Provides read-only mode, query parsing, and formatted output capabilities.
 */
export class DatabaseQueryService {
  private static instance: DatabaseQueryService;

  /**
   * Get singleton instance.
   * @returns DatabaseQueryService instance.
   */
  public static getInstance(): DatabaseQueryService {
    DatabaseQueryService.instance ||= new DatabaseQueryService();
    return DatabaseQueryService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Private constructor
  }

  /**
   * Check if the database is initialized.
   * @returns Promise resolving to initialization status.
   */
  public async isInitialized(): Promise<boolean> {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a query is read-only (SELECT only).
   * @param query - SQL query to check.
   * @returns True if query is read-only.
   */
  public isReadOnlyQuery(query: string): boolean {
    const trimmedQuery = query.trim().toLowerCase();
    const readOnlyPrefixes = ['select', 'show', 'describe', 'explain', 'with'];
    
    return readOnlyPrefixes.some(prefix => trimmedQuery.startsWith(prefix));
  }

  /**
   * Parse multiple queries from a string (separated by semicolons).
   * @param content - Content containing SQL queries.
   * @returns Array of individual queries.
   */
  public parseQueries(content: string): string[] {
    return content
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--'));
  }

  /**
   * Execute a SQL query and return formatted results.
   * @param query - SQL query to execute.
   * @param format - Output format for results.
   * @returns Promise resolving to query result.
   */
  public async executeQuery(query: string, format: OutputFormat): Promise<IQueryResult> {
    const startTime = Date.now();
    
    try {
      const dbService = DatabaseService.getInstance();
      const results = await dbService.query<Record<string, any>>(query);
      const executionTime = Date.now() - startTime;

      const formattedOutput = this.formatResults(results, format);

      return {
        output: formattedOutput,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        output: [`Query failed: ${errorMessage}`],
        executionTime
      };
    }
  }

  /**
   * Format query results based on the specified format.
   * @param results - Query results from database.
   * @param format - Output format.
   * @returns Formatted results array.
   */
  private formatResults(results: Record<string, any>[], format: OutputFormat): string[] {
    if (results.length === 0) {
      return ['(0 rows)'];
    }

    switch (format) {
      case 'json':
        return [JSON.stringify(results, null, 2)];
      
      case 'csv':
        const csvOutput: string[] = [];
        const headers = Object.keys(results[0] || {});
        csvOutput.push(headers.join(','));
        
        for (const row of results) {
          const values = headers.map(header => {
            const value = row[header];
            return value == null ? '' : String(value);
          });
          csvOutput.push(values.join(','));
        }
        return csvOutput;
      
      default: // table format
        if (results.length === 0) {
          return ['(0 rows)'];
        }
        
        const tableOutput: string[] = [];
        const tableHeaders = Object.keys(results[0] || {});
        
        // Calculate column widths
        const colWidths = tableHeaders.map(header => {
          const headerWidth = header.length;
          const maxValueWidth = Math.max(...results.map(row => {
            const value = row[header];
            return value == null ? 0 : String(value).length;
          }));
          return Math.max(headerWidth, maxValueWidth);
        });
        
        // Create header row
        const headerRow = tableHeaders.map((header, i) => header.padEnd(colWidths[i] || 0)).join(' | ');
        tableOutput.push(headerRow);
        
        // Create separator row
        const separatorRow = colWidths.map(width => '-'.repeat(width || 0)).join('|');
        tableOutput.push(separatorRow);
        
        // Create data rows
        for (const row of results) {
          const dataRow = tableHeaders.map((header, i) => {
            const value = row[header];
            const stringValue = value == null ? '' : String(value);
            return stringValue.padEnd(colWidths[i] || 0);
          }).join(' | ');
          tableOutput.push(dataRow);
        }
        
        return tableOutput;
    }
  }
}
