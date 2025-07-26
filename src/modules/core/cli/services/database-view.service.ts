/**
 * Column information interface.
 */
export interface IColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

/**
 * View parameters interface.
 */
export interface IViewParams {
  tableName: string;
  format?: 'table' | 'json' | 'csv';
  limit?: number;
  offset?: number;
  columns?: string;
  where?: string;
  orderBy?: string;
  schemaOnly?: boolean;
}

/**
 * View result interface.
 */
export interface IViewResult {
  success: boolean;
  message?: string;
  data?: {
    table: string;
    totalRows: number;
    displayedRows: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    columns: IColumnInfo[];
    data: unknown[];
  };
  schema?: {
    table: string;
    columns: IColumnInfo[];
  };
}

/**
 * Database view service for CLI operations.
 */
export class DatabaseViewService {
  private static instance: DatabaseViewService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the service instance.
   * @returns The service instance.
   */
  public static getInstance(): DatabaseViewService {
    DatabaseViewService.instance ||= new DatabaseViewService();
    return DatabaseViewService.instance;
  }

  /**
   * Handle view command.
   * @param params - View parameters.
   * @returns View result.
   */
  public async handleView(params: IViewParams): Promise<IViewResult> {
    try {
      // Dynamic import to avoid direct database folder import restriction
      const { DatabaseCLIHandlerService } = await import(
        '../../database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();
      
      return await cliHandler.handleView(params);
    } catch (error) {
      return {
        success: false,
        message: `Error viewing table: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
