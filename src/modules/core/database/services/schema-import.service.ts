/**
 * Schema Import Service.
 * Simple and reliable SQL discovery and import mechanism
 * - Discovers SQL files in module directories
 * - Imports schemas in correct order
 * - Tracks imported schemas to avoid duplicates
 * - No complex migration features, just import.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'crypto';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SQLParserService } from '@/modules/core/database/services/sql-parser.service.js';

export interface SchemaFile {
  module: string;
  filepath: string;
  checksum: string;
  content: string;
}

export interface ImportResult {
  success: boolean;
  imported: string[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
}

export class SchemaImportService {
  private readonly parser: SQLParserService;

  constructor(
    private readonly database: DatabaseService,
    private readonly logger?: ILogger
  ) {
    this.parser = new SQLParserService(logger);
  }

  /**
   * Initialize schema tracking table.
   */
  async initialize(): Promise<void> {
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
   * @param schemaFiles
   */
  async importSchemas(schemaFiles: SchemaFile[]): Promise<ImportResult> {
    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Get already imported schemas
    const existing = await this.getImportedSchemas();
    const existingMap = new Map(
      existing.map(s => { return [`${s.module}:${s.filepath}`, s.checksum] })
    );

    for (const schema of schemaFiles) {
      const key = `${schema.module}:${schema.filepath}`;
      const existingChecksum = existingMap.get(key);

      // Skip if already imported with same checksum
      if (existingChecksum === schema.checksum) {
        skipped.push(key);
        continue;
      }

      // Warn if checksum changed
      if (existingChecksum && existingChecksum !== schema.checksum) {
        this.logger?.warn('Schema file changed after import', {
          module: schema.module,
          file: schema.filepath,
          oldChecksum: existingChecksum,
          newChecksum: schema.checksum
        });
        skipped.push(key);
        continue;
      }

      // Import the schema
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
      success: errors.length === 0,
      imported,
      skipped,
      errors
    };
  }

  /**
   * Import a single schema file.
   * @param schema
   */
  private async importSchema(schema: SchemaFile): Promise<void> {
    this.logger?.info('Importing schema', {
      module: schema.module,
      file: schema.filepath
    });

    // Parse SQL
    const parsed = this.parser.parseSQLFile(schema.content, schema.filepath);

    if (parsed.hasErrors) {
      throw new Error(
        `Schema has syntax errors: ${parsed.errors.map(e => { return `Line ${e.line}: ${e.message}` }).join('; ')}`
      );
    }

    // Categorize statements for proper execution order
    const categorized = this.parser.categorizeStatements(parsed.statements);
    const validStatements = [
      ...categorized.tables,
      ...categorized.indexes,
      ...categorized.triggers,
      ...categorized.data,
      ...categorized.other
    ].filter(stmt => { return stmt.isValid && stmt.statement.trim() });

    if (validStatements.length === 0) {
      this.logger?.warn('No valid statements found in schema file', {
        module: schema.module,
        file: schema.filepath
      });
      return;
    }

    // Execute in transaction
    await this.database.transaction(async (conn) => {
      // Execute statements
      for (const stmt of validStatements) {
        try {
          await conn.execute(stmt.statement);
        } catch (error) {
          throw new Error(
            `Failed at line ${stmt.lineNumber}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Record import
      await conn.execute(
        `INSERT INTO _imported_schemas (module, filepath, checksum)
         VALUES (?, ?, ?)`,
        [schema.module, schema.filepath, schema.checksum]
      );
    });

    this.logger?.info('Schema imported successfully', {
      module: schema.module,
      file: schema.filepath,
      statements: validStatements.length
    });
  }

  /**
   * Load schema file from disk.
   * @param filepath
   * @param module
   */
  async loadSchemaFile(filepath: string, module: string): Promise<SchemaFile> {
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
   */
  async getImportedSchemas(): Promise<Array<{ module: string; filepath: string; checksum: string; imported_at: string }>> {
    return await this.database.query(
      `SELECT module, filepath, checksum, imported_at 
       FROM _imported_schemas 
       ORDER BY id`
    );
  }

  /**
   * Check if a schema has been imported.
   * @param module
   * @param filepath
   */
  async isSchemaImported(module: string, filepath: string): Promise<boolean> {
    const result = await this.database.query<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM _imported_schemas 
       WHERE module = ? AND filepath = ?`,
      [module, filepath]
    );

    return (result[0]?.count ?? 0) > 0;
  }

  /**
   * Calculate checksum for content.
   * @param content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256')
      .update(content.trim())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get import status summary.
   */
  async getImportStatus(): Promise<{
    totalImported: number;
    byModule: Record<string, number>;
    lastImport?: string;
  }> {
    const schemas = await this.getImportedSchemas();

    const byModule: Record<string, number> = {};
    let lastImport: string | undefined;

    for (const schema of schemas) {
      byModule[schema.module] = (byModule[schema.module] || 0) + 1;
      if (!lastImport || schema.imported_at > lastImport) {
        lastImport = schema.imported_at;
      }
    }

    if (lastImport) {
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
