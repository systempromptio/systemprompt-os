/**
 * @fileoverview Import data command
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { DatabaseService } from '../services/database.service.js';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export function createImportCommand(db: DatabaseService, logger: Logger): Command {
  return new Command('import')
    .description('Import data from backup')
    .requiredOption('-f, --file <path>', 'Input file path')
    .option('-t, --type <type>', 'Import type: sql, json', 'sql')
    .option('--dry-run', 'Validate import without executing', false)
    .option('--force', 'Force import even if data exists', false)
    .option('--transaction', 'Run import in a transaction', true)
    .action(async (options) => {
      try {
        logger.info('Starting data import', options);

        // Check if file exists
        await fs.access(options.file);

        // Read file content
        let content: string;
        if (options.file.endsWith('.gz')) {
          content = await readGzipFile(options.file);
        } else {
          content = await fs.readFile(options.file, 'utf-8');
        }

        if (options.dryRun) {
          logger.info('Dry run mode - validating import');
          await validateImport(content, options.type);
          logger.info('Import validation successful');
          process.exit(0);
        }

        // Perform import
        if (options.type === 'sql') {
          await importSQL(
            db,
            content,
            {
              useTransaction: options.transaction,
              force: options.force,
            },
            logger,
          );
        } else if (options.type === 'json') {
          await importJSON(
            db,
            content,
            {
              force: options.force,
            },
            logger,
          );
        }

        logger.info('Data import completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Import failed', error);
        process.exit(1);
      }
    });
}

async function readGzipFile(path: string): Promise<string> {
  const chunks: Buffer[] = [];
  await pipeline(createReadStream(path), createGunzip(), async (source) => {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).toString('utf-8');
}

async function validateImport(content: string, type: string): Promise<void> {
  if (type === 'sql') {
    // Basic SQL validation
    if (!content.includes('CREATE TABLE') && !content.includes('INSERT INTO')) {
      throw new Error('Invalid SQL file - no CREATE TABLE or INSERT statements found');
    }
  } else if (type === 'json') {
    // Validate JSON structure
    const data = JSON.parse(content);
    if (!data.metadata || !data.data) {
      throw new Error('Invalid JSON structure - missing metadata or data');
    }
  }
}

async function importSQL(
  db: DatabaseService,
  sql: string,
  options: { useTransaction: boolean; force: boolean },
  logger: Logger,
): Promise<void> {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  logger.info(`Importing ${statements.length} SQL statements`);

  if (options.useTransaction) {
    await db.execute('BEGIN TRANSACTION');
  }

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip DROP TABLE statements unless force is true
      if (!stmt) {throw new Error('stmt is required');}
      if (stmt.toUpperCase().startsWith('DROP TABLE') && !options.force) {
        logger.warn('Skipping DROP TABLE statement (use --force to execute)');
        continue;
      }

      await db.execute(stmt || '');

      if ((i + 1) % 100 === 0) {
        logger.info(`Executed ${i + 1}/${statements.length} statements`);
      }
    }

    if (options.useTransaction) {
      await db.execute('COMMIT');
    }
  } catch (error) {
    if (options.useTransaction) {
      await db.execute('ROLLBACK');
    }
    throw error;
  }
}

async function importJSON(
  db: DatabaseService,
  jsonStr: string,
  options: { force: boolean },
  logger: Logger,
): Promise<void> {
  const data = JSON.parse(jsonStr);

  if (!data.metadata || !data.data) {
    throw new Error('Invalid JSON structure');
  }

  logger.info(`Importing data for ${data.metadata.tables.length} tables`);

  await db.execute('BEGIN TRANSACTION');

  try {
    for (const table of data.metadata.tables) {
      const rows = data.data[table];
      if (!rows || rows.length === 0) {continue;}

      logger.info(`Importing ${rows.length} rows into ${table}`);

      // Clear existing data if force is true
      if (options.force) {
        await db.execute(`DELETE FROM ${table}`);
      }

      // Insert rows
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((col) => row[col]);
        const placeholders = columns.map(() => '?').join(', ');

        await db.execute(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values,
        );
      }
    }

    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
