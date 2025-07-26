/**
 * Clear parameters interface.
 */
export interface IClearParams {
  force?: boolean;
  confirm?: boolean;
}

/**
 * Clear result interface.
 */
export interface IClearResult {
  success: boolean;
  message: string;
  details?: {
    clearedCount: number;
    failedTables: string[];
    totalRowsCleared: number;
  };
}

/**
 * Database clear service for CLI operations.
 */
export class DatabaseClearService {
  private static instance: DatabaseClearService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the service instance.
   * @returns The service instance.
   */
  public static getInstance(): DatabaseClearService {
    DatabaseClearService.instance ||= new DatabaseClearService();
    return DatabaseClearService.instance;
  }

  /**
   * Handle clear command.
   * @param params - Clear parameters.
   * @returns Clear result.
   */
  public async handleClear(params: IClearParams): Promise<IClearResult> {
    try {
      // Dynamic import to avoid direct database folder import restriction
      const { DatabaseCLIHandlerService } = await import(
        '@/modules/core/database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();

      return await cliHandler.handleClear(params);
    } catch (error) {
      return {
        success: false,
        message: `Error clearing database: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }
}
