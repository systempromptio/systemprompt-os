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
    // Mock implementation - would check actual database initialization
    return true;
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
      // Mock implementation - would execute actual query against database
      const mockResults = this.getMockQueryResults(query, format);
      const executionTime = Date.now() - startTime;

      return {
        output: mockResults,
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
   * Generate mock query results for testing purposes.
   * @param query - SQL query.
   * @param format - Output format.
   * @returns Mock results array.
   */
  private getMockQueryResults(query: string, format: OutputFormat): string[] {
    const trimmedQuery = query.trim().toLowerCase();
    
    if (trimmedQuery.startsWith('select')) {
      switch (format) {
        case 'json':
          return ['[{"id": 1, "name": "example"}]'];
        case 'csv':
          return ['id,name', '1,example'];
        default:
          return [
            'id | name',
            '---|-------',
            '1  | example',
            '(1 row)'
          ];
      }
    }
    
    if (trimmedQuery.startsWith('insert') || trimmedQuery.startsWith('update') || trimmedQuery.startsWith('delete')) {
      return ['Query executed successfully'];
    }
    
    if (trimmedQuery.startsWith('create') || trimmedQuery.startsWith('alter') || trimmedQuery.startsWith('drop')) {
      return ['Schema modified successfully'];
    }
    
    return ['Query executed successfully'];
  }
}
