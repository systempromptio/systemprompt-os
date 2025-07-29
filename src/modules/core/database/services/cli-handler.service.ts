import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import { RebuildHelperService } from '@/modules/core/database/services/rebuild-helper.service';
import { ViewHelperService } from '@/modules/core/database/services/view-helper.service';
import { SummaryHelperService } from '@/modules/core/database/services/summary-helper.service';
import { ClearOperationsHelperService } from '@/modules/core/database/services/clear-operations-helper.service';
import { LoggingHelperService } from '@/modules/core/database/services/logging-helper.service';
import { SchemaListHelperService } from '@/modules/core/database/services/schema-list-helper.service';
import { InitHelperService } from '@/modules/core/database/services/init-helper.service';
import { type ILogger } from '@/modules/core/logger/types/index';
import type { IInstalledSchema } from '@/modules/core/database/types/schema.types';

/**
 * CLI handler service for database commands.
 */
export class DatabaseCLIHandlerService {
  private static instance: DatabaseCLIHandlerService;
  private logger?: ILogger;

  /**
   * Private constructor.
   * Private constructor for singleton pattern is intentionally empty.
   */
  private constructor() {
  }

  /**
   * Get the CLI handler service instance.
   * @param logger - Optional logger instance.
   * @returns The CLI handler service instance.
   */
  public static getInstance(logger?: ILogger): DatabaseCLIHandlerService {
    DatabaseCLIHandlerService.instance ||= new DatabaseCLIHandlerService();
    if (logger !== undefined) {
      DatabaseCLIHandlerService.instance.logger = logger;
    }
    return DatabaseCLIHandlerService.instance;
  }

  /**
   * Handle status command.
   * @returns Status information.
   */
  public handleStatus(): { connected: boolean; type: string; message: string } {
    try {
      const db = DatabaseService.getInstance();
      const isConnected = db.isConnected();
      const dbType = db.getDatabaseType();

      return {
        connected: isConnected,
        type: dbType,
        message: isConnected
          ? `Connected to ${dbType} database`
          : 'Database not connected'
      };
    } catch (error) {
      return {
        connected: false,
        type: 'unknown',
        message: `Error checking status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }

  /**
   * Handle migrate command.
   * @returns Migration result.
   */
  public async handleMigrate(): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const migrationService = MigrationService.getInstance();
      await migrationService.runMigrations();

      return {
        success: true,
        message: 'Migrations completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  /**
   * Handle init command.
   * @returns Initialization result.
   */
  public async handleInit(): Promise<{ success: boolean; message: string }> {
    return await InitHelperService.handleInit();
  }

  /**
   * Handle view command.
   * @param params - View parameters.
   * @param params.tableName - Name of the table to view.
   * @param params.format - Output format.
   * @param params.limit - Maximum number of rows.
   * @param params.offset - Number of rows to skip.
   * @param params.columns - Comma-separated column names.
   * @param params.where - SQL WHERE clause.
   * @param params.orderBy - SQL ORDER BY clause.
   * @param params.schemaOnly - If true, only show schema.
   * @returns View result.
   */
  public async handleView(params: {
    tableName: string;
    format?: 'table' | 'json' | 'csv';
    limit?: number;
    offset?: number;
    columns?: string;
    where?: string;
    orderBy?: string;
    schemaOnly?: boolean;
  }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      if (!db.isConnected()) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const exists = await ViewHelperService.checkTableExists(params.tableName);
      if (!exists) {
        return {
          success: false,
          message: `Table '${params.tableName}' does not exist`
        };
      }

      const schema = await ViewHelperService.getTableSchema(params.tableName);
      if (params.schemaOnly === true) {
        return {
          success: true,
          schema: {
            table: params.tableName,
            columns: schema
          }
        };
      }

      const query = ViewHelperService.buildViewQuery(params, schema);
      const rows = await db.query(query.query, query.queryParams);
      const total = await ViewHelperService.getRowCount(params.tableName, params.where);

      return {
        success: true,
        data: {
          table: params.tableName,
          totalRows: total,
          displayedRows: rows.length,
          offset: params.offset ?? 0,
          limit: params.limit ?? 50,
          hasMore: (params.offset ?? 0) + rows.length < total,
          columns: schema,
          data: rows
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error viewing table: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }

  /**
   * Handle rebuild command.
   * @param params - Rebuild parameters.
   * @param params.force - Skip confirmation.
   * @param params.confirm - Confirm operation.
   * @returns Rebuild result.
   */
  public async handleRebuild(params: {
    force?: boolean;
    confirm?: boolean;
  }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      if (!db.isConnected()) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const tables = await db.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );

      LoggingHelperService.getInstance().logRebuildWarning(tables, this.logger);

      if (params.force !== true && params.confirm !== true) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed.'
        };
      }

      const dropResult = await RebuildHelperService.dropAllTables(tables, this.logger);
      if (!dropResult.success) {
        return {
          success: false,
          message: dropResult.message ?? 'Operation failed',
          details: {
            tablesDropped: 0,
            schemasFound: 0,
            filesImported: 0,
            filesSkipped: 0,
            errors: [dropResult.message ?? 'Operation failed']
          }
        };
      }

      const schemaResult = await RebuildHelperService.discoverSchemas(this.logger);
      if (!schemaResult.success) {
        return {
          success: false,
          message: schemaResult.message ?? 'Operation failed',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: schemaResult.schemasFound,
            filesImported: 0,
            filesSkipped: 0,
            errors: [schemaResult.message ?? 'Operation failed']
          }
        };
      }

      const importResult = await RebuildHelperService.importSchemas(
        schemaResult.schemaFiles,
        this.logger
      );

      await RebuildHelperService.optimizeDatabase(this.logger);

      const finalTables = await db.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );

      LoggingHelperService.getInstance().logRebuildComplete(finalTables, this.logger);

      return {
        success: true,
        message: 'Database rebuild completed successfully!',
        details: {
          tablesDropped: dropResult.tablesDropped,
          schemasFound: schemaResult.schemasFound,
          filesImported: importResult.filesImported,
          filesSkipped: importResult.filesSkipped,
          errors: importResult.importSuccess ? [] : importResult.errors
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          tablesDropped: 0,
          schemasFound: 0,
          filesImported: 0,
          filesSkipped: 0,
          errors: []
        }
      };
    }
  }

  /**
   * Handle summary command.
   * @param params - Summary parameters.
   * @param params.format - Output format ('text', 'json', or 'table').
   * @param params.includeSystem - Whether to include system tables.
   * @param params.sortBy - Sort criteria ('name', 'rows', or 'columns').
   * @returns Summary result.
   */
  public async handleSummary(params: {
    format?: 'text' | 'json' | 'table';
    includeSystem?: boolean;
    sortBy?: 'name' | 'rows' | 'columns';
  }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      if (!db.isConnected()) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const tables = await SummaryHelperService.getTables(params.includeSystem ?? false);
      const tableInfos = await Promise.all<ReturnType<typeof SummaryHelperService.getTableInfo> | null>(
        tables.map(async (table): Promise<ReturnType<typeof SummaryHelperService.getTableInfo> | null> => {
          try {
            return await SummaryHelperService.getTableInfo(table.name);
          } catch {
            return null;
          }
        })
      );

      const validInfos = tableInfos.filter((info): info is NonNullable<typeof info> => {
        return info !== null;
      });

      const sorted = SummaryHelperService.sortTableInfos(validInfos, params.sortBy ?? 'name');
      const stats = SummaryHelperService.calculateSummaryStats(sorted);

      return {
        success: true,
        data: {
          ...stats,
          tables: sorted,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting database summary: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }

  /**
   * Handle clear command.
   * @param params - Clear parameters.
   * @param params.force - Skip confirmation.
   * @param params.confirm - Confirm operation.
   * @returns Clear result.
   */
  public async handleClear(params: {
    force?: boolean;
    confirm?: boolean;
  }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      if (!db.isConnected()) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const tables = await db.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%' ORDER BY name`
      );

      if (tables.length === 0) {
        return {
          success: true,
          message: 'No user tables found to clear',
          details: {
            clearedCount: 0,
            failedTables: [],
            totalRowsCleared: 0
          }
        };
      }

      LoggingHelperService.getInstance().logClearWarning(tables, this.logger);

      if (params.force !== true && params.confirm !== true) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed.'
        };
      }

      const result = await ClearOperationsHelperService.getInstance().clearTables(tables, this.logger);
      LoggingHelperService.getInstance().logClearComplete(result, this.logger);
      await ClearOperationsHelperService.getInstance().optimizeDatabase(this.logger);

      return {
        success: true,
        message: 'Database clear completed successfully!',
        details: result
      };
    } catch (error) {
      return {
        success: false,
        message: `Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * List installed schemas.
   * @returns Schema list result.
   */
  public async listSchemas(): Promise<{
    success: boolean;
    message?: string;
    data?: { schemas: IInstalledSchema[] };
  }> {
    return await SchemaListHelperService.listSchemas();
  }

  /**
   * Initialize database schemas.
   * @param params - Initialization parameters.
   * @param params.force - Force reinitialize even if already initialized.
   * @param params.module - Specific module to initialize (optional).
   * @returns Initialization result.
   */
  public async initializeSchemas(params: {
    force?: boolean;
    module?: string;
  }): Promise<unknown> {
    return await SchemaListHelperService.initializeSchemas(params);
  }

  /**
   * Validate database schemas.
   * @param params - Validation parameters.
   * @param params.module - Specific module to validate (optional).
   * @returns Validation result.
   */
  public async validateSchemas(params: { module?: string }): Promise<unknown> {
    return await SchemaListHelperService.validateSchemas(params);
  }
}
