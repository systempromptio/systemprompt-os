/**
 * @fileoverview Clean old/unused data command
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { DatabaseService } from '../services/database.service.js';

export function createCleanCommand(db: DatabaseService, logger: Logger): Command {
  return new Command('clean')
    .description('Clean old/unused data')
    .option('--dry-run', 'Show what would be cleaned without doing it', false)
    .option('--all', 'Clean all types of data', false)
    .option('--logs', 'Clean old log entries', false)
    .option('--sessions', 'Clean expired sessions', false)
    .option('--tokens', 'Clean expired tokens', false)
    .option('--stats', 'Clean old statistics', false)
    .option('--cache', 'Clean cache entries', false)
    .option('--age <days>', 'Clean data older than N days', '30')
    .option('--vacuum', 'Run VACUUM after cleaning', true)
    .action(async (options) => {
      try {
        logger.info('Starting data cleanup', options);

        const ageDays = parseInt(options.age);
        const cutoffDate = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);

        let totalDeleted = 0;
        const results: CleanupResult[] = [];

        // Determine what to clean
        const cleanTargets = {
          logs: options.all || options.logs,
          sessions: options.all || options.sessions,
          tokens: options.all || options.tokens,
          stats: options.all || options.stats,
          cache: options.all || options.cache,
        };

        if (!Object.values(cleanTargets).some((v) => v)) {
          logger.warn('No cleanup targets specified. Use --all or specific flags.');
          process.exit(1);
        }

        // Clean each target
        if (cleanTargets.logs) {
          const result = await cleanLogs(db, cutoffDate, options.dryRun, logger);
          results.push(result);
          totalDeleted += result.deleted;
        }

        if (cleanTargets.sessions) {
          const result = await cleanSessions(db, options.dryRun, logger);
          results.push(result);
          totalDeleted += result.deleted;
        }

        if (cleanTargets.tokens) {
          const result = await cleanTokens(db, options.dryRun, logger);
          results.push(result);
          totalDeleted += result.deleted;
        }

        if (cleanTargets.stats) {
          const result = await cleanStats(db, cutoffDate, options.dryRun, logger);
          results.push(result);
          totalDeleted += result.deleted;
        }

        if (cleanTargets.cache) {
          const result = await cleanCache(db, options.dryRun, logger);
          results.push(result);
          totalDeleted += result.deleted;
        }

        // Show results
        logger.info('Cleanup Results:');
        results.forEach((result) => {
          logger.info(
            `  ${result.type}: ${result.deleted} records ${options.dryRun ? 'would be' : ''} deleted`,
          );
          if (result.spaceSaved) {
            logger.info(`    Space saved: ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`);
          }
        });

        logger.info(`Total: ${totalDeleted} records ${options.dryRun ? 'would be' : ''} deleted`);

        // Run VACUUM if not dry run and requested
        if (!options.dryRun && options.vacuum && totalDeleted > 0) {
          logger.info('Running VACUUM to reclaim space...');
          const beforeSize = await getDatabaseSize(db);
          await db.execute('VACUUM');
          const afterSize = await getDatabaseSize(db);
          const spaceSaved = beforeSize - afterSize;

          if (spaceSaved > 0) {
            logger.info(`Database size reduced by ${(spaceSaved / 1024 / 1024).toFixed(2)} MB`);
          }
        }

        process.exit(0);
      } catch (error) {
        logger.error('Cleanup failed', error);
        process.exit(1);
      }
    });
}

interface CleanupResult {
  type: string;
  deleted: number;
  spaceSaved?: number;
}

async function cleanLogs(
  db: DatabaseService,
  cutoffDate: Date,
  dryRun: boolean,
  logger: Logger,
): Promise<CleanupResult> {
  const logTables = ['system_logs', 'audit_logs', 'error_logs', 'access_logs'];

  let totalDeleted = 0;

  for (const table of logTables) {
    try {
      // Check if table exists
      const exists = await tableExists(db, table);
      if (!exists) {continue;}

      // Count records to delete
      const countResult = await db.query<{ count: number }>(
        `
        SELECT COUNT(*) as count FROM ${table}
        WHERE created_at < ?
      `,
        [cutoffDate.toISOString()],
      );

      const count = countResult[0]?.count || 0;

      if (count > 0 && !dryRun) {
        await db.execute(
          `
          DELETE FROM ${table}
          WHERE created_at < ?
        `,
          [cutoffDate.toISOString()],
        );
      }

      totalDeleted += count;
      logger.info(`  ${table}: ${count} records`);
    } catch (error) {
      logger.warn(`Failed to clean ${table}:`, error);
    }
  }

  return { type: 'Logs', deleted: totalDeleted };
}

async function cleanSessions(
  db: DatabaseService,
  dryRun: boolean,
  logger: Logger,
): Promise<CleanupResult> {
  try {
    // Check if auth_sessions table exists
    if (!(await tableExists(db, 'auth_sessions'))) {
      return { type: 'Sessions', deleted: 0 };
    }

    // Count expired sessions
    const countResult = await db.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM auth_sessions
      WHERE expires_at < datetime('now')
    `);

    const count = countResult[0]?.count || 0;

    if (count > 0 && !dryRun) {
      await db.execute(`
        DELETE FROM auth_sessions
        WHERE expires_at < datetime('now')
      `);
    }

    return { type: 'Sessions', deleted: count };
  } catch (error) {
    logger.warn('Failed to clean sessions:', error);
    return { type: 'Sessions', deleted: 0 };
  }
}

async function cleanTokens(
  db: DatabaseService,
  dryRun: boolean,
  logger: Logger,
): Promise<CleanupResult> {
  try {
    // Check if auth_tokens table exists
    if (!(await tableExists(db, 'auth_tokens'))) {
      return { type: 'Tokens', deleted: 0 };
    }

    // Count expired or revoked tokens
    const countResult = await db.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM auth_tokens
      WHERE expires_at < datetime('now')
      OR is_revoked = 1
    `);

    const count = countResult[0]?.count || 0;

    if (count > 0 && !dryRun) {
      await db.execute(`
        DELETE FROM auth_tokens
        WHERE expires_at < datetime('now')
        OR is_revoked = 1
      `);
    }

    return { type: 'Tokens', deleted: count };
  } catch (error) {
    logger.warn('Failed to clean tokens:', error);
    return { type: 'Tokens', deleted: 0 };
  }
}

async function cleanStats(
  db: DatabaseService,
  cutoffDate: Date,
  dryRun: boolean,
  logger: Logger,
): Promise<CleanupResult> {
  const statsTables = ['mcp_stats', 'api_usage_stats', 'performance_stats'];

  let totalDeleted = 0;

  for (const table of statsTables) {
    try {
      if (!(await tableExists(db, table))) {continue;}

      const countResult = await db.query<{ count: number }>(
        `
        SELECT COUNT(*) as count FROM ${table}
        WHERE created_at < ?
      `,
        [cutoffDate.toISOString()],
      );

      const count = countResult[0]?.count || 0;

      if (count > 0 && !dryRun) {
        await db.execute(
          `
          DELETE FROM ${table}
          WHERE created_at < ?
        `,
          [cutoffDate.toISOString()],
        );
      }

      totalDeleted += count;
    } catch (error) {
      logger.warn(`Failed to clean ${table}:`, error);
    }
  }

  return { type: 'Statistics', deleted: totalDeleted };
}

async function cleanCache(
  db: DatabaseService,
  dryRun: boolean,
  logger: Logger,
): Promise<CleanupResult> {
  try {
    // Check if mcp_cache table exists
    if (!(await tableExists(db, 'mcp_cache'))) {
      return { type: 'Cache', deleted: 0 };
    }

    // Count expired cache entries
    const countResult = await db.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM mcp_cache
      WHERE expires_at < datetime('now')
    `);

    const count = countResult[0]?.count || 0;

    if (count > 0 && !dryRun) {
      await db.execute(`
        DELETE FROM mcp_cache
        WHERE expires_at < datetime('now')
      `);
    }

    return { type: 'Cache', deleted: count };
  } catch (error) {
    logger.warn('Failed to clean cache:', error);
    return { type: 'Cache', deleted: 0 };
  }
}

async function tableExists(db: DatabaseService, tableName: string): Promise<boolean> {
  const result = await db.query<{ count: number }>(
    `
    SELECT COUNT(*) as count FROM sqlite_master
    WHERE type='table' AND name=?
  `,
    [tableName],
  );

  return (result[0]?.count || 0) > 0;
}

async function getDatabaseSize(db: DatabaseService): Promise<number> {
  try {
    const result = await db.query<{ page_count: number; page_size: number }>(`
      SELECT page_count * page_size as size
      FROM pragma_page_count(), pragma_page_size()
    `);

    const row = result[0] as any;
    return row?.size || 0;
  } catch {
    return 0;
  }
}
