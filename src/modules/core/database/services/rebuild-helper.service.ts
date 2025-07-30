import { createHash } from 'crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import { SchemaImportService } from '@/modules/core/database/services/schema-import.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

/**
 * Helper service for database rebuild operations.
 */
export class RebuildHelperService {
  /**
   * Drop all tables in the database.
   * @param tables - Array of table information.
   * @param logger - Logger instance.
   * @returns Drop result.
   */
  static async dropAllTables(
    tables: Array<{ name: string }>,
    logger?: ILogger
  ): Promise<{
    success: boolean;
    message?: string;
    tablesDropped: number;
  }> {
    if (logger) {
      logger.info(LogSource.DATABASE, 'Phase 1: Dropping all tables...');
      logger.info(LogSource.DATABASE, '');
    }

    let droppedCount = 0;
    const failedDrops: string[] = [];

    const dbService = DatabaseService.getInstance();
    await dbService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
      await conn.execute('PRAGMA foreign_keys = OFF');

      const tablesResult = await conn.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );
      const currentTables = tablesResult.rows;

      for (const table of currentTables) {
        try {
          await conn.execute(`DROP TABLE IF EXISTS "${table.name}"`);
          if (logger) {
            logger.info(LogSource.DATABASE, `Dropped table: ${table.name}`);
          }
          droppedCount += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (logger) {
            logger.error(LogSource.DATABASE, `Could not drop ${table.name}: ${errorMessage}`);
          }
          failedDrops.push(table.name);
        }
      }

      try {
        await conn.execute('DELETE FROM _imported_schemas WHERE 1=1');
        if (logger) {
          logger.info(LogSource.DATABASE, 'Cleared schema import tracking');
        }
      } catch (error) {
        if (logger) {
          logger.debug(LogSource.DATABASE, 'Schema import tracking table not found or already cleared');
        }
      }

      await conn.execute('PRAGMA foreign_keys = ON');
    });

    if (logger) {
      logger.info(LogSource.DATABASE, '');
      logger.info(LogSource.DATABASE, `Tables dropped: ${droppedCount.toString()}/${tables.length.toString()}`);
    }

    if (failedDrops.length > 0) {
      if (logger) {
        logger.error(LogSource.DATABASE, 'Failed to drop some tables:');
        for (const table of failedDrops) {
          logger.error(LogSource.DATABASE, `  - ${table}`);
        }
        logger.error(LogSource.DATABASE, '');
        logger.error(LogSource.DATABASE, 'Rebuild cannot continue with remaining tables.');
      }

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
   * @param logger - Logger instance.
   * @returns Discovery result.
   */
  static async discoverSchemas(
    logger?: ILogger
  ): Promise<{
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
    if (logger) {
      logger.info(LogSource.DATABASE, '');
      logger.info(LogSource.DATABASE, 'Phase 2: Discovering schema files...');
      logger.info(LogSource.DATABASE, '');
    }

    const schemaService = SchemaService.getInstance();
    await schemaService.discoverSchemas();

    const schemas = schemaService.getAllSchemas();
    if (logger) {
      logger.info(LogSource.DATABASE, `Found ${schemas.size.toString()} modules with schemas:`);
    }

    const schemaFiles: Array<{
      module: string;
      filepath: string;
      checksum: string;
      content: string;
    }> = [];

    for (const [moduleKey, schema] of Array.from(schemas)) {
      if (logger) {
        logger.info(LogSource.DATABASE, `  - ${moduleKey}`);
      }

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

    if (schemaFiles.length === 0 && logger) {
      logger.warn(LogSource.DATABASE, 'Warning: No schema files found. Database will be empty.');
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
   * @param logger - Logger instance.
   * @returns Import result.
   */
  static async importSchemas(
    schemaFiles: Array<{
      module: string;
      filepath: string;
      checksum: string;
      content: string;
    }>,
    logger?: ILogger
  ): Promise<{
    success: boolean;
    message?: string;
    importSuccess: boolean;
    filesImported: number;
    filesSkipped: number;
    errors: string[];
  }> {
    if (logger) {
      logger.info(LogSource.DATABASE, '');
      logger.info(LogSource.DATABASE, 'Phase 3: Importing schemas...');
      logger.info(LogSource.DATABASE, '');
    }

    const importService = SchemaImportService.getInstance();
    await importService.initialize();

    const importResult = await importService.importSchemas(schemaFiles);

    if (logger) {
      logger.info(LogSource.DATABASE, 'Schema Import Results:');
      logger.info(LogSource.DATABASE, `  Imported: ${importResult.imported.length.toString()} files`);
      logger.info(LogSource.DATABASE, `  Skipped: ${importResult.skipped.length.toString()} files`);
      logger.info(LogSource.DATABASE, `  Errors: ${importResult.errors.length.toString()} files`);

      if (importResult.imported.length > 0) {
        logger.info(LogSource.DATABASE, '');
        logger.info(LogSource.DATABASE, 'Successfully imported:');
        for (const file of importResult.imported) {
          logger.info(LogSource.DATABASE, `  ${file}`);
        }
      }

      if (importResult.skipped.length > 0) {
        logger.info(LogSource.DATABASE, '');
        logger.info(LogSource.DATABASE, 'Skipped (already up-to-date):');
        for (const file of importResult.skipped) {
          logger.info(LogSource.DATABASE, `  ${file}`);
        }
      }

      if (importResult.errors.length > 0) {
        logger.info(LogSource.DATABASE, '');
        logger.error(LogSource.DATABASE, 'Import errors:');
        for (const errorInfo of importResult.errors) {
          logger.error(LogSource.DATABASE, `  ${errorInfo.file}: ${errorInfo.error}`);
        }
      }
    }

    return {
      success: true,
      importSuccess: importResult.success,
      filesImported: importResult.imported.length,
      filesSkipped: importResult.skipped.length,
      errors: importResult.errors.map(
        (e: { file: string; error: string }): string => { return `${e.file}: ${e.error}` }
      )
    };
  }

  /**
   * Optimize the database.
   * @param logger - Logger instance.
   * @returns Promise that resolves when optimization is complete.
   */
  static async optimizeDatabase(logger?: ILogger): Promise<void> {
    if (logger) {
      logger.info(LogSource.DATABASE, '');
      logger.info(LogSource.DATABASE, 'Phase 4: Optimizing database...');
    }
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.execute('VACUUM');
      if (logger) {
        logger.info(LogSource.DATABASE, 'Database optimized');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (logger) {
        logger.warn(LogSource.DATABASE, `Warning: VACUUM failed: ${errorMessage}`);
      }
    }
  }
}
