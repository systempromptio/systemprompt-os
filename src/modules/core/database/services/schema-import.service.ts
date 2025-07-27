/**
 * Schema Import Service.
 * Simple and reliable SQL discovery and import mechanism.
 * @file Schema import service.
 * @module database/services/schema-import
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { IImportResult, ISchemaFile } from '@/modules/core/database/types/schema-import.types';
import { ZERO } from '@/modules/core/database/constants/index';

import type { IDatabaseService, ISQLParserService } from '@/modules/core/database/types/schema-import.types';

/**
 * Schema import service for managing database schemas.
 */
export class SchemaImportService {
  private static instance: SchemaImportService;
  private parser?: ISQLParserService;
  private database?: IDatabaseService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Creates a new schema import service instance.
   */
  private constructor() {
  }

  /**
   * Initialize the schema import service.
   * @param database - Database service instance.
   * @param parser - SQL parser service instance.
   * @param logger - Optional logger instance.
   * @returns The initialized schema import service instance.
   */
  public static initialize(
    database: IDatabaseService,
    parser: ISQLParserService,
    logger?: ILogger
  ): SchemaImportService {
    SchemaImportService.instance ||= new SchemaImportService();
    SchemaImportService.instance.database = database;
    SchemaImportService.instance.parser = parser;
    if (logger !== undefined) {
      SchemaImportService.instance.logger = logger;
    }
    SchemaImportService.instance.initialized = true;
    return SchemaImportService.instance;
  }

  /**
   * Get the schema import service instance.
   * @returns The schema import service instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): SchemaImportService {
    if (!SchemaImportService.instance?.initialized) {
      throw new Error('SchemaImportService not initialized. Call initialize() first.');
    }
    return SchemaImportService.instance;
  }

  /**
   * Initialize schema tracking table.
   * @returns Promise that resolves when table is created.
   */
  public async initialize(): Promise<void> {
    if (this.database === undefined) {
      throw new Error('Database service not initialized');
    }

    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS _imported_schemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        filepath TEXT NOT NULL,
        checksum TEXT NOT NULL,
        imported_at TEXT DEFAULT (datetime('now')),
        UNIQUE(module, filepath)
      )
    `);
  }

  /**
   * Import schema files.
   * @param schemaFiles - Array of schema files to import.
   * @returns Import result with success status and details.
   */
  public async importSchemas(schemaFiles: ISchemaFile[]): Promise<IImportResult> {
    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    const existing = await this.getImportedSchemas();
    const existingMap = new Map(
      existing.map((schema): [string, string] =>
        { return [`${schema.module}:${schema.filepath}`, schema.checksum] })
    );

    for (const schema of schemaFiles) {
      const key = `${schema.module}:${schema.filepath}`;
      const existingChecksum = existingMap.get(key);

      if (existingChecksum === schema.checksum) {
        skipped.push(key);
        continue;
      }

      if (existingChecksum !== undefined && existingChecksum !== schema.checksum) {
        this.logger?.warn(LogSource.DATABASE, 'Schema file changed after import', {
          module: schema.module,
          file: schema.filepath,
          oldChecksum: existingChecksum,
          newChecksum: schema.checksum
        });
        skipped.push(key);
        continue;
      }

      try {
        await this.importSchema(schema);
        imported.push(key);
      } catch (error) {
        errors.push({
          file: key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      success: errors.length === ZERO,
      imported,
      skipped,
      errors
    };
  }

  /**
   * Import a single schema file.
   * @param schema - Schema file to import.
   * @returns Promise that resolves when schema is imported.
   */
  private async importSchema(schema: ISchemaFile): Promise<void> {
    if (!this.parser || !this.database) {
      throw new Error('Parser or database service not initialized');
    }

    this.logger?.info(LogSource.DATABASE, 'Importing schema', {
      module: schema.module,
      file: schema.filepath
    });

    const parsed = this.parser.parseSQLFile(schema.content, schema.filepath);

    if (parsed.hasErrors) {
      const errorMessages = parsed.errors
        .map((errorItem: { line: number; message: string }): string =>
          { return `Line ${errorItem.line}: ${errorItem.message}` })
        .join('; ');
      throw new Error(`Schema has syntax errors: ${errorMessages}`);
    }

    const categorized = this.parser.categorizeStatements(parsed.statements);
    const validStatements = [
      ...categorized.tables,
      ...categorized.indexes,
      ...categorized.triggers,
      ...categorized.dataStatements || [],
      ...categorized.other
    ].filter((stmt): boolean => { return stmt.isValid && stmt.statement.trim() !== '' });

    if (validStatements.length === ZERO) {
      this.logger?.warn(LogSource.DATABASE, 'No valid statements found in schema file', {
        module: schema.module,
        file: schema.filepath
      });
      return;
    }

    await this.database.transaction(async (conn: {
      execute(sql: string, params?: unknown[]): Promise<void>;
      query<U>(sql: string, params?: unknown[]): Promise<U[]>;
    }): Promise<void> => {
      try {
        await conn.execute(schema.content);
      } catch (error) {
        throw new Error(
          `[${schema.filepath}] Failed to execute schema: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      await conn.execute(
        `INSERT INTO _imported_schemas (module, filepath, checksum)
         VALUES (?, ?, ?)`,
        [schema.module, schema.filepath, schema.checksum]
      );
    });

    this.logger?.info(LogSource.DATABASE, 'Schema imported successfully', {
      module: schema.module,
      file: schema.filepath,
      statements: validStatements.length
    });
  }

  /**
   * Load schema file from disk.
   * @param filepath - Path to schema file.
   * @param module - Module name.
   * @returns Schema file object.
   */
  public async loadSchemaFile(filepath: string, module: string): Promise<ISchemaFile> {
    const content = await readFile(filepath, 'utf-8');

    return {
      module,
      filepath,
      checksum: this.calculateChecksum(content),
      content
    };
  }

  /**
   * Get list of imported schemas.
   * @returns Array of imported schema records.
   */
  public async getImportedSchemas(): Promise<Array<{
    module: string;
    filepath: string;
    checksum: string;
    imported_at: string
  }>> {
    if (this.database === undefined) {
      throw new Error('Database service not initialized');
    }

    return await this.database.query(
      `SELECT module, filepath, checksum, imported_at 
       FROM _imported_schemas 
       ORDER BY id`
    );
  }

  /**
   * Check if a schema has been imported.
   * @param module - Module name.
   * @param filepath - File path.
   * @returns True if schema has been imported.
   */
  public async isSchemaImported(module: string, filepath: string): Promise<boolean> {
    if (this.database === undefined) {
      throw new Error('Database service not initialized');
    }

    const result = await this.database.query<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM _imported_schemas 
       WHERE module = ? AND filepath = ?`,
      [module, filepath]
    );

    const firstResult = result[ZERO];
    return firstResult !== undefined && firstResult.count > ZERO;
  }

  /**
   * Calculate checksum for content.
   * @param content - Content to calculate checksum for.
   * @returns Checksum string.
   */
  private calculateChecksum(content: string): string {
    const CHECKSUM_LENGTH = 16;
    return createHash('sha256')
      .update(content.trim())
      .digest('hex')
      .substring(ZERO, CHECKSUM_LENGTH);
  }

  /**
   * Get import status summary.
   * @returns Import status with totals and breakdown by module.
   */
  public async getImportStatus(): Promise<{
    totalImported: number;
    byModule: Record<string, number>;
    lastImport?: string;
  }> {
    const schemas = await this.getImportedSchemas();

    const byModule: Record<string, number> = {};
    let lastImport: string | undefined;

    for (const schema of schemas) {
      const currentCount = byModule[schema.module] ?? ZERO;
      byModule[schema.module] = currentCount + 1;
      if (lastImport === undefined || schema.imported_at > lastImport) {
        lastImport = schema.imported_at;
      }
    }

    if (lastImport !== undefined) {
      return {
        totalImported: schemas.length,
        byModule,
        lastImport
      };
    }

    return {
      totalImported: schemas.length,
      byModule
    };
  }
}
