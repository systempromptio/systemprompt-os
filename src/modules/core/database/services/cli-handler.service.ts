/**
 * CLI Handler Service for database commands.
 * Provides service methods that can be called by CLI without direct imports.
 * @file CLI handler service.
 * @module database/services/cli-handler
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import type { ILogger } from '@/modules/core/logger/types/index';

/**
 * CLI handler service for database commands.
 */
export class DatabaseCLIHandlerService {
  private static instance: DatabaseCLIHandlerService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the CLI handler service instance.
   * @param logger - Optional logger instance.
   * @returns The CLI handler service instance.
   */
  public static getInstance(logger?: ILogger): DatabaseCLIHandlerService {
    DatabaseCLIHandlerService.instance ||= new DatabaseCLIHandlerService();
    if (logger !== undefined) {
    }
    return DatabaseCLIHandlerService.instance;
  }

  /**
   * Handle status command.
   * @returns Status information.
   */
  public async handleStatus(): Promise<{ connected: boolean; type: string; message: string }> {
    try {
      const db = DatabaseService.getInstance();
      const isConnected = await db.isConnected();
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
        message: `Error checking status: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    try {
      const schemaService = SchemaService.getInstance();
      await schemaService.initializeBaseSchema();
      await schemaService.initializeSchemas();

      return {
        success: true,
        message: 'Database initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle view command.
   * @param params - View parameters.
   * @param params.tableName
   * @param params.format
   * @param params.limit
   * @param params.offset
   * @param params.columns
   * @param params.where
   * @param params.orderBy
   * @param params.schemaOnly
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
  }): Promise<{
    success: boolean;
    message?: string;
    data?: {
      table: string;
      totalRows: number;
      displayedRows: number;
      offset: number;
      limit: number;
      hasMore: boolean;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
        defaultValue: string | null;
      }>;
      data: unknown[];
    };
    schema?: {
      table: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
        defaultValue: string | null;
      }>;
    };
  }> {
    try {
      const dbService = DatabaseService.getInstance();

      if (!await dbService.isConnected()) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const tableExists = await dbService.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?",
        [params.tableName]
      );

      if (tableExists[0]?.count === 0) {
        return {
          success: false,
          message: `Table '${params.tableName}' does not exist`
        };
      }

      const schema = await dbService.query<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>(`PRAGMA table_info(\`${params.tableName}\`)`);

      const columnInfo = schema.map(col => { return {
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primaryKey: col.pk > 0,
        defaultValue: col.dflt_value,
      } });

      if (params.schemaOnly === true) {
        return {
          success: true,
          schema: {
            table: params.tableName,
            columns: columnInfo
          }
        };
      }

      let selectColumns = '*';
      if (params.columns !== undefined) {
        const requestedColumns = params.columns.split(',').map(c => { return c.trim() });
        const validColumns = columnInfo.map(c => { return c.name });
        const invalidColumns = requestedColumns.filter(c => { return !validColumns.includes(c) });

        if (invalidColumns.length > 0) {
          return {
            success: false,
            message: `Invalid columns: ${invalidColumns.join(', ')}`
          };
        }

        selectColumns = requestedColumns.map(c => { return `\`${c}\`` }).join(', ');
      }

      let query = `SELECT ${selectColumns} FROM \`${params.tableName}\``;
      const queryParams: unknown[] = [];

      if (params.where !== undefined) {
        query += ` WHERE ${params.where}`;
      }

      if (params.orderBy !== undefined) {
        query += ` ORDER BY ${params.orderBy}`;
      }

      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);

      const rows = await dbService.query(query, queryParams);

      let countQuery = `SELECT COUNT(*) as count FROM \`${params.tableName}\``;
      if (params.where !== undefined) {
        countQuery += ` WHERE ${params.where}`;
      }
      const totalResult = await dbService.query<{ count: number }>(countQuery);
      const totalRows = totalResult[0]?.count ?? 0;

      return {
        success: true,
        data: {
          table: params.tableName,
          totalRows,
          displayedRows: rows.length,
          offset,
          limit,
          hasMore: offset + rows.length < totalRows,
          columns: columnInfo,
          data: rows,
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error viewing table: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
