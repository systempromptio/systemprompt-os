/**
 * @fileoverview Database restore command
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { DatabaseService } from '../services/database.service.js';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export function createRestoreCommand(db: DatabaseService, logger: Logger): Command {
  return new Command('restore')
    .description('Restore database from backup')
    .requiredOption('-f, --file <path>', 'Backup file path')
    .option('--verify', 'Verify backup before restore', true)
    .option('--force', 'Force restore without confirmation', false)
    .option('--dry-run', 'Show what would be restored without doing it', false)
    .action(async (options) => {
      try {
        logger.info('Starting database restore', options);

        // Check if backup file exists
        await fs.access(options.file);

        // Load metadata if available
        const metaPath = options.file.replace(/\.(sql|sql\.gz)$/, '.meta.json');
        let metadata: any = null;
        try {
          metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          logger.info('Backup metadata:', metadata);
        } catch {
          logger.warn('No metadata file found for backup');
        }

        if (options.verify) {
          logger.info('Verifying backup...');
          await verifyBackup(options.file, metadata);
          logger.info('Backup verification passed');
        }

        if (options.dryRun) {
          logger.info('Dry run mode - showing restore information');
          if (metadata) {
            logger.info(`Backup created: ${metadata.timestamp}`);
            logger.info(`Tables to restore: ${metadata.tables.join(', ')}`);
            logger.info(`Backup size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
          }
          process.exit(0);
        }

        if (!options.force) {
          logger.warn('WARNING: This will replace all existing data!');
          logger.warn('Use --force to proceed without confirmation');
          process.exit(1);
        }

        // Create pre-restore backup
        logger.info('Creating pre-restore backup...');
        const preRestoreBackup = `./backup/pre-restore-${Date.now()}.sql.gz`;
        await createPreRestoreBackup(db);
        logger.info(`Pre-restore backup created: ${preRestoreBackup}`);

        // Perform restore
        await restoreDatabase(db, options.file, logger);

        logger.info('Database restore completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Restore failed', error);
        process.exit(1);
      }
    });
}

async function verifyBackup(backupPath: string, metadata: any): Promise<void> {
  // Check file exists and is readable
  const stats = await fs.stat(backupPath);

  if (metadata && stats.size !== metadata.size) {
    throw new Error('Backup file size does not match metadata');
  }

  // For compressed files, try to decompress a small portion
  if (backupPath.endsWith('.gz')) {
    const gunzip = createGunzip();
    const stream = createReadStream(backupPath, { start: 0, end: 1024 });

    try {
      await pipeline(stream, gunzip, async (source) => {
        for await (const _chunk of source) {
          // Just consume the first chunk to verify it's valid gzip
          break;
        }
      });
    } catch {
      throw new Error('Invalid gzip file');
    }
  }
}

async function createPreRestoreBackup(db: DatabaseService): Promise<void> {
  const { createBackupCommand } = await import('./backup.js');

  // Create a simple logger for the backup command
  const backupLogger: Logger = {
    info: () => {},
    warn: () => {},
    error: console.error,
    debug: () => {},
    addLog: () => {},
    clearLogs: async () => {},
    getLogs: async () => [],
  };

  // Execute backup silently
  await new Promise<void>((resolve, reject) => {
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      process.exit = originalExit;
      if (code === 0) {resolve();}
      else {reject(new Error(`Backup failed with code ${code}`));}
    }) as any;

    createBackupCommand(db, backupLogger)
      .parseAsync(['', '', '-n', 'pre-restore', '-d', './backup'], { from: 'node' })
      .catch(reject);
  });
}

async function restoreDatabase(
  db: DatabaseService,
  backupPath: string,
  logger: Logger,
): Promise<void> {
  logger.info('Reading backup file...');

  // Read backup content
  let content: string;
  if (backupPath.endsWith('.gz')) {
    content = await readGzipFile(backupPath);
  } else {
    content = await fs.readFile(backupPath, 'utf-8');
  }

  // Check if it's a binary SQLite file or SQL dump
  if (content.startsWith('SQLite format')) {
    // Binary SQLite file - need to use different approach
    throw new Error('Binary SQLite restore not yet implemented. Use SQL dump backups.');
  }

  // Parse SQL statements
  const statements = content
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  logger.info(`Restoring ${statements.length} SQL statements`);

  // Start transaction
  await db.execute('BEGIN EXCLUSIVE TRANSACTION');

  try {
    // Drop all existing tables
    const tables = await db.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `);

    for (const table of tables) {
      await db.execute(`DROP TABLE IF EXISTS ${table.name}`);
    }

    // Execute restore statements
    for (let i = 0; i < statements.length; i++) {
      await db.execute(statements[i]!);

      if ((i + 1) % 100 === 0) {
        logger.info(`Executed ${i + 1}/${statements.length} statements`);
      }
    }

    await db.execute('COMMIT');
    logger.info('Restore transaction committed');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
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
