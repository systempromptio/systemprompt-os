/**
 * @fileoverview Export data command
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { DatabaseService } from '../services/database.service.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { createWriteStream } from 'fs';

export function createExportCommand(db: DatabaseService, logger: Logger): Command {
  return new Command('export')
    .description('Export database data')
    .option('-t, --tables <tables>', 'Comma-separated list of tables to export (default: all)')
    .option('-f, --format <format>', 'Export format: sql, json, csv', 'sql')
    .option('-o, --output <path>', 'Output file path', './backup/export.sql')
    .option('-c, --compress', 'Compress output with gzip', false)
    .option('--no-schema', 'Export data only, no schema')
    .option('--no-data', 'Export schema only, no data')
    .action(async (options) => {
      try {
        logger.info('Starting data export', options);

        const outputPath = options.compress ? `${options.output}.gz` : options.output;

        // Ensure output directory exists
        await fs.mkdir(dirname(outputPath), { recursive: true });

        let exportData = '';

        // Get tables to export
        const tables = options.tables
          ? options.tables.split(',').map((t: string) => t.trim())
          : await getTableList(db);

        if (options.format === 'sql') {
          exportData = await exportSQL(db, tables, {
            includeSchema: options.schema !== false,
            includeData: options.data !== false,
          });
        } else if (options.format === 'json') {
          exportData = await exportJSON(db, tables);
        } else if (options.format === 'csv') {
          // CSV export would be table-by-table
          throw new Error('CSV export not yet implemented');
        }

        // Write to file
        if (options.compress) {
          const writeStream = createWriteStream(outputPath);
          const gzipStream = createGzip();
          await pipeline(
            async function* () {
              yield exportData;
            },
            gzipStream,
            writeStream,
          );
        } else {
          await fs.writeFile(outputPath, exportData);
        }

        logger.info(`Data exported to ${outputPath}`);
        process.exit(0);
      } catch (error) {
        logger.error('Export failed', error);
        process.exit(1);
      }
    });
}

async function getTableList(db: DatabaseService): Promise<string[]> {
  const result = await db.query<{ name: string }>(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  return result.map((r) => r.name);
}

async function exportSQL(
  db: DatabaseService,
  tables: string[],
  options: { includeSchema: boolean; includeData: boolean },
): Promise<string> {
  let sql = '-- SystemPrompt OS Database Export\n';
  sql += `-- Generated at: ${new Date().toISOString()}\n\n`;

  for (const table of tables) {
    if (options.includeSchema) {
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
        sql += `DROP TABLE IF EXISTS ${table};\n`;
        sql += `${schemaResult[0].sql};\n\n`;
      }
    }

    if (options.includeData) {
      // Export data
      const data = await db.query(`SELECT * FROM ${table}`);
      if (data.length > 0) {
        sql += `-- Data for table: ${table}\n`;
        for (const row of data) {
          const columns = Object.keys(row as object);
          const values = columns.map((col) => {
            const val = (row as any)[col];
            if (val === null) {return 'NULL';}
            if (typeof val === 'number') {return val;}
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sql += '\n';
      }
    }
  }

  return sql;
}

async function exportJSON(db: DatabaseService, tables: string[]): Promise<string> {
  const data: Record<string, any> = {
    metadata: {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      tables: tables,
    },
    data: {},
  };

  for (const table of tables) {
    const rows = await db.query(`SELECT * FROM ${table}`);
    data['data'][table] = rows;
  }

  return JSON.stringify(data, null, 2);
}
