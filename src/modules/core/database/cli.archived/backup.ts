/**
 * @file Database backup command.
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export function createBackupCommand(db: DatabaseService, logger: ILogger): Command {
  return new Command('backup')
    .description('Create database backup')
    .option('-d, --dir <path>', 'Backup directory', './backup')
    .option('-n, --name <name>', 'Backup name (default: timestamp)')
    .option('-c, --compress', 'Compress backup with gzip', true)
    .option('--include-logs', 'Include log tables in backup', false)
    .option('--retention <days>', 'Delete backups older than N days', '30')
    .action(async (options) => {
      try {
        logger.info('Starting database backup', options);

        // Generate backup name
        const timestamp = new Date().toISOString()
.replace(/:/g, '-')
.split('.')[0];
        const backupName = options.name || `backup-${timestamp}`;
        const extension = options.compress ? '.sql.gz' : '.sql';
        const backupPath = join(options.dir, `${backupName}${extension}`);

        // Ensure backup directory exists
        await fs.mkdir(options.dir, { recursive: true });

        // Create backup
        await createBackup(
          db,
          backupPath,
          {
            compress: options.compress,
            includeLogs: options.includeLogs,
          },
          logger,
        );

        // Create metadata file
        const metadata = {
          timestamp,
          version: '1.0.0',
          compressed: options.compress,
          includeLogs: options.includeLogs,
          size: (await fs.stat(backupPath)).size,
          tables: await getBackupTables(db, options.includeLogs),
        };

        await fs.writeFile(
          join(options.dir, `${backupName}.meta.json`),
          JSON.stringify(metadata, null, 2),
        );

        // Clean old backups
        if (parseInt(options.retention) > 0) {
          await cleanOldBackups(options.dir, parseInt(options.retention), logger);
        }

        logger.info(`Backup created: ${backupPath}`);
        logger.info(`Backup size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
        process.exit(0);
      } catch (error) {
        logger.error('Backup failed', error);
        process.exit(1);
      }
    });
}

async function createBackup(
  db: DatabaseService,
  backupPath: string,
  options: { compress: boolean; includeLogs: boolean },
  logger: ILogger,
): Promise<void> {
  // Use SQLite's backup API if available, otherwise export SQL
  const dbPath = await db.query<{ file: string }>(`PRAGMA database_list`);

  if (dbPath[0]?.file) {
    // Direct file copy for SQLite
    logger.info('Creating backup using file copy method');

    if (options.compress) {
      await pipeline(createReadStream(dbPath[0].file), createGzip(), createWriteStream(backupPath));
    } else {
      await fs.copyFile(dbPath[0].file, backupPath);
    }
  } else {
    // SQL dump method
    logger.info('Creating backup using SQL dump method');

    const tables = await getBackupTables(db, options.includeLogs);
    let sql = '-- SystemPrompt OS Database Backup\n';
    sql += `-- Created at: ${new Date().toISOString()}\n\n`;

    // Dump each table
    for (const table of tables) {
      // Get table schema
      const schemaResult = await db.query<{ sql: string }>(
        `
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name=?
      `,
        [table],
      );

      if (schemaResult[0]) {
        sql += `-- Table: ${table}\n`;
        sql += `${schemaResult[0].sql};\n\n`;

        // Get table data
        const data = await db.query(`SELECT * FROM ${table}`);
        if (data.length > 0) {
          for (const row of data) {
            const columns = Object.keys(row as object);
            const values = columns.map((col) => {
              const val = (row as any)[col];
              if (val === null) { return 'NULL'; }
              if (typeof val === 'number') { return val; }
              return `'${String(val).replace(/'/g, "''")}'`;
            });

            sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }
          sql += '\n';
        }
      }
    }

    // Write backup
    if (options.compress) {
      const writeStream = createWriteStream(backupPath);
      const gzipStream = createGzip();
      await pipeline(
        async function* () {
          yield sql;
        },
        gzipStream,
        writeStream,
      );
    } else {
      await fs.writeFile(backupPath, sql);
    }
  }
}

async function getBackupTables(db: DatabaseService, includeLogs: boolean): Promise<string[]> {
  const result = await db.query<{ name: string }>(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ${includeLogs ? '' : "AND name NOT LIKE '%_log%' AND name NOT LIKE '%_logs%'"}
    ORDER BY name
  `);
  return result.map((r) => { return r.name });
}

async function cleanOldBackups(dir: string, retentionDays: number, logger: ILogger): Promise<void> {
  const files = await fs.readdir(dir);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  for (const file of files) {
    if (file.endsWith('.meta.json')) {
      try {
        const metaPath = join(dir, file);
        const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        const backupDate = new Date(metadata.timestamp);

        if (backupDate < cutoffDate) {
          // Delete backup and metadata
          const backupName = file.replace('.meta.json', '');
          const backupPath = join(dir, `${backupName}${metadata.compressed ? '.sql.gz' : '.sql'}`);

          await fs.unlink(metaPath);
          await fs.unlink(backupPath).catch(() => {}); // Ignore if backup file doesn't exist

          logger.info(`Deleted old backup: ${backupName}`);
        }
      } catch (error) {
        logger.warn(`Failed to process backup metadata: ${file}`, error);
      }
    }
  }
}
