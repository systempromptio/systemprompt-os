/**
 * Summary parameters interface.
 */
export interface ISummaryParams {
  format?: 'text' | 'json' | 'table';
  includeSystem?: boolean;
  sortBy?: 'name' | 'rows' | 'columns';
}

/**
 * Summary result interface.
 */
export interface ISummaryResult {
  success: boolean;
  message?: string;
  data?: {
    totalTables: number;
    totalRows: number;
    averageRowsPerTable: number;
    tables: Array<{
      name: string;
      rowCount: number;
      columnCount: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
    }>;
    timestamp: string;
  };
}

/**
 * Database summary service for CLI operations.
 */
export class DatabaseSummaryService {
  private static instance: DatabaseSummaryService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the service instance.
   * @returns The service instance.
   */
  public static getInstance(): DatabaseSummaryService {
    DatabaseSummaryService.instance ||= new DatabaseSummaryService();
    return DatabaseSummaryService.instance;
  }

  /**
   * Handle summary command.
   * @param params - Summary parameters.
   * @returns Summary result.
   */
  public async handleSummary(params: ISummaryParams): Promise<ISummaryResult> {
    try {
      // Dynamic import to avoid direct database folder import restriction
      const { DatabaseCLIHandlerService } = await import(
        '@/modules/core/database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();

      return await cliHandler.handleSummary(params);
    } catch (error) {
      return {
        success: false,
        message: `Error getting database summary: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
}
