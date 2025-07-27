import { createHash } from 'crypto';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import { DatabaseService } from './database.service';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import { MigrationService } from './migration.service';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import { SchemaService } from './schema.service';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import { SchemaImportService } from './schema-import.service';
// eslint-disable-next-line systemprompt-os/enforce-path-alias
import { type ILogger, LogSource } from '../../logger/types/index';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import type { IDatabaseConnection } from '../types/database.types';
// eslint-disable-next-line systemprompt-os/enforce-import-restrictions, systemprompt-os/enforce-path-alias
import type { IInstalledSchema, IModuleSchema } from '../types/schema.types';

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
        message: `Initialization failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }

  /**
   * Get table schema information.
   * @param tableName - Name of the table.
   * @returns Column information.
   */
  private async getTableSchema(tableName: string): Promise<Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue: string | null;
  }>> {
    const dbService = DatabaseService.getInstance();
    const schema = await dbService.query<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA table_info(\`${tableName}\`)`);

    return schema.map((col: {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }): {
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
      defaultValue: string | null;
    } => { return {
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      primaryKey: col.pk > 0,
      defaultValue: col.dflt_value,
    }; });
  }

  /**
   * Build select query for view command.
   * @param params - View parameters.
   * @param params.tableName - Name of the table.
   * @param params.columns - Comma-separated column names.
   * @param params.where - SQL WHERE clause.
   * @param params.orderBy - SQL ORDER BY clause.
   * @param params.limit - Maximum rows to return.
   * @param params.offset - Number of rows to skip.
   * @param columnInfo - Column information.
   * @returns Query and parameters.
   */
  private buildViewQuery(params: {
    tableName: string;
    columns?: string;
    where?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }, columnInfo: Array<{ name: string }>): {
    query: string;
    queryParams: unknown[];
    selectColumns: string;
  } {
    let selectColumns = '*';

    if (params.columns !== undefined) {
      const requestedColumns = params.columns.split(',').map((col: string): string => { return col.trim(); });
      const validColumns = columnInfo.map((col: { name: string }): string => { return col.name; });
      const invalidColumns = requestedColumns.filter(
        (col: string): boolean => { return !validColumns.includes(col); }
      );

      if (invalidColumns.length > 0) {
        throw new Error(`Invalid columns: ${invalidColumns.join(', ')}`);
      }

      selectColumns = requestedColumns.map((col: string): string => { return `\`${col}\``; }).join(', ');
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

    return {
      query,
      queryParams,
      selectColumns
    };
  }

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

      const connected = dbService.isConnected();
      if (!connected) {
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

      const columnInfo = await this.getTableSchema(params.tableName);

      if (params.schemaOnly === true) {
        return {
          success: true,
          schema: {
            table: params.tableName,
            columns: columnInfo
          }
        };
      }

      let queryResult;
      try {
        queryResult = this.buildViewQuery(params, columnInfo);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Invalid query parameters'
        };
      }

      const { query, queryParams } = queryResult;
      const rows = await dbService.query(query, queryParams);
      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;

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
        message: `Error viewing table: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }

  /**
   * Handle rebuild command - destroys and recreates entire database.
   * @param params - Rebuild parameters.
   * @param params.force - Skip confirmation (dangerous).
   * @param params.confirm - Confirm operation understanding.
   * @returns Rebuild result.
   */
  public async handleRebuild(params: {
    force?: boolean;
    confirm?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    details?: {
      tablesDropped: number;
      schemasFound: number;
      filesImported: number;
      filesSkipped: number;
      errors: string[];
    };
  }> {
    const { force = false, confirm = false } = params;

    try {
      const dbService = DatabaseService.getInstance();

      const connected = dbService.isConnected();
      if (!connected) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const allTables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      );

      this.logWarning('DANGER: Database Rebuild Operation');
      this.logWarning('=====================================');
      this.logWarning('This will COMPLETELY DESTROY AND RECREATE the entire database:');
      this.logWarning('');
      this.logWarning('1. DROP all existing tables and data');
      this.logWarning('2. Scan for schema files in all modules');
      this.logWarning('3. Recreate database from schema files');
      this.logWarning('');

      if (allTables.length > 0) {
        this.logWarning(`Tables that will be DESTROYED (${allTables.length.toString()} total):`);
        for (const table of allTables) {
          this.logWarning(`  - ${table.name}`);
        }
        this.logWarning('');
      }

      this.logWarning('ALL DATA WILL BE PERMANENTLY LOST');
      this.logWarning('THIS OPERATION CANNOT BE UNDONE');
      this.logWarning('MAKE SURE YOU HAVE BACKUPS');
      this.logWarning('');

      if (!force && !confirm) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed.'
        };
      }

      if (!force) {
        this.logInfo('You have confirmed that you want to rebuild the database.');
        this.logInfo('Starting rebuild operation...');
        this.logInfo('');
      }

      const dropResult = await this.dropAllTables(allTables);
      if (!dropResult.success) {
        return {
          success: false,
          message: dropResult.message ?? 'Failed to drop tables',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: 0,
            filesImported: 0,
            filesSkipped: 0,
            errors: dropResult.message !== undefined
              ? [dropResult.message]
              : ['Failed to drop tables']
          }
        };
      }

      const schemaResult = await this.discoverSchemas();
      if (!schemaResult.success) {
        return {
          success: false,
          message: schemaResult.message ?? 'Failed to discover schemas',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: schemaResult.schemasFound,
            filesImported: 0,
            filesSkipped: 0,
            errors: schemaResult.message !== undefined
              ? [schemaResult.message]
              : ['Failed to discover schemas']
          }
        };
      }

      const importResult = await this.importSchemas(schemaResult.schemaFiles);
      if (!importResult.success) {
        return {
          success: false,
          message: importResult.message ?? 'Failed to import schemas',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: schemaResult.schemasFound,
            filesImported: importResult.filesImported,
            filesSkipped: importResult.filesSkipped,
            errors: importResult.message !== undefined
              ? [importResult.message]
              : ['Failed to import schemas']
          }
        };
      }

      await this.optimizeDatabase();

      const finalTables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      );

      this.logInfo('Database Rebuild Complete!');
      this.logInfo('=============================');
      this.logInfo(`Database now contains ${finalTables.length.toString()} tables:`);
      for (const table of finalTables) {
        this.logInfo(`  - ${table.name}`);
      }

      if (!importResult.importSuccess) {
        this.logWarning('');
        this.logWarning('Some schema imports failed. Database may be incomplete.');
        this.logWarning('Check the error messages above and fix any schema issues.');
        return {
          success: false,
          message: 'Database rebuild completed with errors. Some schemas failed to import.',
          details: {
            tablesDropped: dropResult.tablesDropped,
            schemasFound: schemaResult.schemasFound,
            filesImported: importResult.filesImported,
            filesSkipped: importResult.filesSkipped,
            errors: importResult.errors
          }
        };
      }

      this.logInfo('');
      this.logInfo('Database rebuild completed successfully!');

      return {
        success: true,
        message: 'Database rebuild completed successfully!',
        details: {
          tablesDropped: dropResult.tablesDropped,
          schemasFound: schemaResult.schemasFound,
          filesImported: importResult.filesImported,
          filesSkipped: importResult.filesSkipped,
          errors: []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError(`Error rebuilding database: ${error instanceof Error ? error.message : String(error)}`);
      this.logError('');
      this.logError('Database may be in an inconsistent state.');
      this.logError('You may need to manually fix issues or restore from backup.');

      return {
        success: false,
        message: `Rebuild failed: ${errorMessage}`,
        details: {
          tablesDropped: 0,
          schemasFound: 0,
          filesImported: 0,
          filesSkipped: 0,
          errors: [errorMessage]
        }
      };
    }
  }

  /**
   * Drop all tables in the database.
   * @param tables - Array of table information.
   * @returns Drop result.
   */
  private async dropAllTables(tables: Array<{ name: string }>): Promise<{
    success: boolean;
    message?: string;
    tablesDropped: number;
  }> {
    this.logInfo('Phase 1: Dropping all tables...');
    this.logInfo('');

    let droppedCount = 0;
    const failedDrops: string[] = [];

    const dbService = DatabaseService.getInstance();
    await dbService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
      await conn.execute('PRAGMA foreign_keys = OFF');

      for (const table of tables) {
        try {
          await conn.execute(`DROP TABLE IF EXISTS \`${table.name}\``);
          this.logInfo(`Dropped table: ${table.name}`);
          droppedCount += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logError(`Failed to drop ${table.name}: ${errorMessage}`);
          failedDrops.push(table.name);
        }
      }

      await conn.execute('PRAGMA foreign_keys = ON');
    });

    this.logInfo('');
    this.logInfo(`Tables dropped: ${droppedCount.toString()}/${tables.length.toString()}`);

    if (failedDrops.length > 0) {
      this.logError('Failed to drop some tables:');
      for (const table of failedDrops) {
        this.logError(`  - ${table}`);
      }
      this.logError('');
      this.logError('Rebuild cannot continue with remaining tables.');

      return {
        success: false,
        message: 'Failed to drop some tables. Cannot continue rebuild.',
        tablesDropped: droppedCount
      };
    }

    return {
      success: true,
      tablesDropped: droppedCount
    };
  }

  /**
   * Discover all schema files.
   * @returns Discovery result.
   */
  private async discoverSchemas(): Promise<{
    success: boolean;
    message?: string;
    schemasFound: number;
    schemaFiles: Array<{
      module: string;
      filepath: string;
      checksum: string;
      content: string;
    }>;
  }> {
    this.logInfo('');
    this.logInfo('Phase 2: Discovering schema files...');
    this.logInfo('');

    const schemaService = SchemaService.getInstance();
    await schemaService.discoverSchemas();

    const schemas = schemaService.getAllSchemas();
    this.logInfo(`Found ${schemas.size.toString()} modules with schemas:`);

    const schemaFiles: Array<{
      module: string;
      filepath: string;
      checksum: string;
      content: string;
    }> = [];

    for (const [moduleKey, schema] of Array.from(schemas)) {
      this.logInfo(`  - ${moduleKey}`);

      const checksum = createHash('sha256').update(schema.sql)
.digest('hex');

      schemaFiles.push({
        module: moduleKey,
        filepath: schema.schemaPath,
        checksum,
        content: schema.sql,
      });

      if (schema.initPath !== undefined && schema.initSql !== undefined) {
        const initChecksum = createHash('sha256').update(schema.initSql)
.digest('hex');
        schemaFiles.push({
          module: moduleKey,
          filepath: schema.initPath,
          checksum: initChecksum,
          content: schema.initSql,
        });
      }
    }

    if (schemaFiles.length === 0) {
      this.logWarning('Warning: No schema files found. Database will be empty.');
    }

    return {
      success: true,
      schemasFound: schemas.size,
      schemaFiles
    };
  }

  /**
   * Import all schema files.
   * @param schemaFiles - Array of schema files to import.
   * @returns Import result.
   */
  private async importSchemas(schemaFiles: Array<{
    module: string;
    filepath: string;
    checksum: string;
    content: string;
  }>): Promise<{
    success: boolean;
    message?: string;
    importSuccess: boolean;
    filesImported: number;
    filesSkipped: number;
    errors: string[];
  }> {
    this.logInfo('');
    this.logInfo('Phase 3: Importing schemas...');
    this.logInfo('');

    const importService = SchemaImportService.getInstance();
    await importService.initialize();

    const importResult = await importService.importSchemas(schemaFiles);

    this.logInfo('Schema Import Results:');
    this.logInfo(`  Imported: ${importResult.imported.length.toString()} files`);
    this.logInfo(`  Skipped: ${importResult.skipped.length.toString()} files`);
    this.logInfo(`  Errors: ${importResult.errors.length.toString()} files`);

    if (importResult.imported.length > 0) {
      this.logInfo('');
      this.logInfo('Successfully imported:');
      for (const file of importResult.imported) {
        this.logInfo(`  ${file}`);
      }
    }

    if (importResult.skipped.length > 0) {
      this.logInfo('');
      this.logInfo('Skipped (already up-to-date):');
      for (const file of importResult.skipped) {
        this.logInfo(`  ${file}`);
      }
    }

    if (importResult.errors.length > 0) {
      this.logInfo('');
      this.logError('Import errors:');
      for (const errorInfo of importResult.errors) {
        this.logError(`  ${errorInfo.file}: ${errorInfo.error}`);
      }
    }

    return {
      success: true,
      importSuccess: importResult.success,
      filesImported: importResult.imported.length,
      filesSkipped: importResult.skipped.length,
      errors: importResult.errors.map(
        (e: { file: string; error: string }): string => { return `${e.file}: ${e.error}`; }
      )
    };
  }

  /**
   * Optimize the database.
   * @returns Promise that resolves when optimization is complete.
   */
  private async optimizeDatabase(): Promise<void> {
    this.logInfo('');
    this.logInfo('Phase 4: Optimizing database...');
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.execute('VACUUM');
      this.logInfo('Database optimized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logWarning(`Warning: VACUUM failed: ${errorMessage}`);
    }
  }

  /**
   * Log info message.
   * @param message - Message to log.
   */
  private logInfo(message: string): void {
    if (this.logger !== undefined) {
      this.logger.info(LogSource.DATABASE, message);
    }
  }

  /**
   * Log warning message.
   * @param message - Message to log.
   */
  private logWarning(message: string): void {
    if (this.logger !== undefined) {
      this.logger.warn(LogSource.DATABASE, message);
    }
  }

  /**
   * Handle summary command.
   * @param params - Summary parameters.
   * @param params.format - Output format (text, json, or table).
   * @param params.includeSystem - Include system tables in summary.
   * @param params.sortBy - Sort criteria (name, rows, or columns).
   * @returns Summary result.
   */
  public async handleSummary(params: {
    format?: 'text' | 'json' | 'table';
    includeSystem?: boolean;
    sortBy?: 'name' | 'rows' | 'columns';
  }): Promise<{
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
  }> {
    try {
      const dbService = DatabaseService.getInstance();

      const connected = dbService.isConnected();
      if (!connected) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const { includeSystem = false, sortBy = 'name' } = params;

      let tableQuery = "SELECT name FROM sqlite_master WHERE type='table'";
      if (!includeSystem) {
        tableQuery += " AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'";
      }
      tableQuery += ' ORDER BY name';

      const tables = await dbService.query<{ name: string }>(tableQuery);
      const tableInfos: Array<{
        name: string;
        rowCount: number;
        columnCount: number;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          primaryKey: boolean;
        }>;
      }> = [];

      for (const table of tables) {
        try {
          const rowCountResult = await dbService.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM \`${table.name}\``
          );
          const rowCount = rowCountResult[0]?.count ?? 0;

          const columns = await dbService.query<{
            name: string;
            type: string;
            notnull: number;
            pk: number;
          }>(`PRAGMA table_info(\`${table.name}\`)`);

          const columnInfo = columns.map((col: {
            name: string;
            type: string;
            notnull: number;
            pk: number;
          }): {
            name: string;
            type: string;
            nullable: boolean;
            primaryKey: boolean;
          } => { return {
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            primaryKey: col.pk > 0,
          }; });

          tableInfos.push({
            name: table.name,
            rowCount,
            columnCount: columns.length,
            columns: columnInfo,
          });
        } catch {
        }
      }

      tableInfos.sort((tableA, tableB): number => {
        switch (sortBy) {
          case 'rows':
            return tableB.rowCount - tableA.rowCount;
          case 'columns':
            return tableB.columnCount - tableA.columnCount;
          case 'name':
          default:
            return tableA.name.localeCompare(tableB.name);
        }
      });

      const totalRows = tableInfos.reduce(
        (sum, table): number => { return sum + table.rowCount },
        0
      );

      const summary = {
        totalTables: tableInfos.length,
        totalRows,
        averageRowsPerTable:
          tableInfos.length > 0 ? Math.round(totalRows / tableInfos.length) : 0,
        tables: tableInfos,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: summary
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting database summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle clear command - clears all data from database tables (preserves schema).
   * @param params - Clear parameters.
   * @param params.force - Skip confirmation (dangerous).
   * @param params.confirm - Confirm operation understanding.
   * @returns Clear result.
   */
  public async handleClear(params: {
    force?: boolean;
    confirm?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    details?: {
      clearedCount: number;
      failedTables: string[];
      totalRowsCleared: number;
    };
  }> {
    const { force = false, confirm = false } = params;

    try {
      const dbService = DatabaseService.getInstance();

      const connected = dbService.isConnected();
      if (!connected) {
        return {
          success: false,
          message: 'Database is not connected'
        };
      }

      const tables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' 
         AND name NOT LIKE '_%'
         ORDER BY name`
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

      this.logWarning('WARNING: Database Clear Operation');
      this.logWarning('=====================================');
      this.logWarning('This will DELETE ALL DATA from the following tables:');
      this.logWarning('');

      for (const table of tables) {
        this.logWarning(`  - ${table.name}`);
      }

      this.logWarning('');
      this.logWarning('The table schemas will be preserved, but ALL DATA WILL BE LOST.');
      this.logWarning('This operation CANNOT be undone.');
      this.logWarning('');

      if (!force && !confirm) {
        return {
          success: false,
          message: 'Confirmation required. Use --force or --confirm to proceed.'
        };
      }

      if (!force) {
        this.logInfo('You have confirmed that you want to clear all data.');
        this.logInfo('Starting clear operation...');
        this.logInfo('');
      }

      let clearedCount = 0;
      let totalRowsCleared = 0;
      const failedTables: string[] = [];

      await dbService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
        for (const table of tables) {
          try {
            const beforeCount = await conn.query<{ count: number }>(
              `SELECT COUNT(*) as count FROM \`${table.name}\``
            );
            const rowsBefore = beforeCount.rows[0]?.count ?? 0;

            await conn.execute(`DELETE FROM \`${table.name}\``);

            this.logInfo(`Cleared ${table.name} (${rowsBefore.toLocaleString()} rows deleted)`);
            clearedCount += 1;
            totalRowsCleared += rowsBefore;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logError(`Failed to clear ${table.name}: ${errorMessage}`);
            failedTables.push(table.name);
          }
        }
      });

      this.logInfo('');
      this.logInfo('Clear Operation Complete');
      this.logInfo('========================');
      this.logInfo(`Successfully cleared: ${clearedCount.toString()} tables`);
      this.logInfo(`Total rows deleted: ${totalRowsCleared.toLocaleString()}`);

      if (failedTables.length > 0) {
        this.logInfo(`Failed to clear: ${failedTables.length.toString()} tables`);
        this.logInfo('Failed tables:');
        for (const table of failedTables) {
          this.logInfo(`  - ${table}`);
        }
      }

      try {
        this.logInfo('');
        this.logInfo('Running VACUUM to reclaim disk space...');
        await dbService.execute('VACUUM');
        this.logInfo('Database optimized');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logWarning(`Warning: VACUUM failed: ${errorMessage}`);
      }

      this.logInfo('');
      this.logInfo('Database clear completed successfully!');

      return {
        success: true,
        message: 'Database clear completed successfully!',
        details: {
          clearedCount,
          failedTables,
          totalRowsCleared
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError(`Error clearing database: ${error instanceof Error ? error.message : String(error)}`);

      return {
        success: false,
        message: `Clear failed: ${errorMessage}`
      };
    }
  }

  /**
   * Log error message.
   * @param message - Message to log.
   */
  private logError(message: string): void {
    if (this.logger !== undefined) {
      this.logger.error(LogSource.DATABASE, message);
    }
  }

  /**
   * List installed schemas.
   * @returns Schema list result.
   */
  public async listSchemas(): Promise<{
    success: boolean;
    message?: string;
    data?: {
      schemas: IInstalledSchema[];
    };
  }> {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaService = SchemaService.getInstance();

      const isInitialized = Boolean(dbService.isInitialized());
      if (!isInitialized) {
        return {
          success: true,
          message: 'Database is not initialized. No schemas installed.',
          data: { schemas: [] }
        };
      }

      const schemas = await schemaService.getInstalledSchemas();
      return {
        success: true,
        data: { schemas }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
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
  }): Promise<{
    success: boolean;
    message?: string;
    warnings?: string[];
    results?: Array<{
      module: string;
      success: boolean;
      message?: string;
    }>;
  }> {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaService = SchemaService.getInstance();
      const warnings: string[] = [];
      const results: Array<{
        module: string;
        success: boolean;
        message?: string;
      }> = [];

      const isInitialized = Boolean(dbService.isInitialized());
      if (isInitialized && params.force !== true) {
        return {
          success: false,
          message: 'Database is already initialized. Use --force to reinitialize.'
        };
      }

      if (isInitialized && params.force === true) {
        warnings.push('WARNING: Force initializing will reset the database!');
        warnings.push('This action cannot be undone.');
      }

      await schemaService.initializeBaseSchema();
      results.push({
        module: 'base',
        success: true,
        message: 'Base schema initialized'
      });

      if (params.module !== undefined) {
        const discoveredSchemas = await schemaService.discoverSchemasArray();
        const moduleSchema = discoveredSchemas.find(
          (schema: IModuleSchema): boolean => { return (schema.moduleName ?? schema.module) === params.module }
        );

        if (moduleSchema === undefined) {
          return {
            success: false,
            message: `Module '${params.module}' not found or has no schema.`
          };
        }

        await schemaService.installModuleSchema(moduleSchema);
        results.push({
          module: params.module,
          success: true,
          message: `Schema for ${params.module} initialized`
        });
      } else {
        const discoveredSchemas = await schemaService.discoverSchemasArray();

        for (const schema of discoveredSchemas) {
          try {
            await schemaService.installModuleSchema(schema);
            results.push({
              module: schema.moduleName ?? schema.module,
              success: true,
              message: 'Success'
            });
          } catch (error) {
            results.push({
              module: schema.moduleName ?? schema.module,
              success: false,
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      return {
        success: true,
        warnings,
        results
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate database schemas.
   * @param params - Validation parameters.
   * @param params.module - Specific module to validate (optional).
   * @returns Validation result.
   */
  public async validateSchemas(params: {
    module?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    issues?: Array<{
      module: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }> {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaService = SchemaService.getInstance();
      const issues: Array<{
        module: string;
        message: string;
        severity: 'error' | 'warning';
      }> = [];

      const isInitialized = Boolean(dbService.isInitialized());
      if (!isInitialized) {
        return {
          success: false,
          message: 'Database is not initialized. Nothing to validate.'
        };
      }

      const [installedSchemas, discoveredSchemas] = await Promise.all([
        schemaService.getInstalledSchemas(),
        schemaService.discoverSchemasArray()
      ]);

      if (params.module !== undefined) {
        const installedSchema = installedSchemas.find(
          (schema: IInstalledSchema): boolean => { return schema.moduleName === params.module }
        );

        if (installedSchema === undefined) {
          issues.push({
            module: params.module,
            message: 'Schema is not installed',
            severity: 'error'
          });
        }
      } else {
        for (const discoveredSchema of discoveredSchemas) {
          const installedSchema = installedSchemas.find(
            (schema: IInstalledSchema): boolean => { return schema.moduleName === (discoveredSchema.moduleName ?? discoveredSchema.module) }
          );

          if (installedSchema === undefined) {
            issues.push({
              module: discoveredSchema.moduleName ?? discoveredSchema.module,
              message: 'Schema is not installed',
              severity: 'error'
            });
          }
        }

        for (const installedSchema of installedSchemas) {
          const discoveredSchema = discoveredSchemas.find(
            (schema: IModuleSchema): boolean => { return (schema.moduleName ?? schema.module) === installedSchema.moduleName }
          );

          if (discoveredSchema === undefined) {
            issues.push({
              module: installedSchema.moduleName,
              message: 'Installed schema has no corresponding module',
              severity: 'warning'
            });
          }
        }
      }

      return {
        success: true,
        issues
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
