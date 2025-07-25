/**
 * @file Clear logs CLI command.
 * @module modules/core/logger/cli/clear
 * Command to clear logs from the database with various filtering options.
 */

import { createInterface } from 'readline';
import type { ICLIContext } from '@/modules/core/cli/types/index.js';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';

interface ClearLogsOptions {
  level?: string;
  olderThan?: string;
  confirm?: boolean;
  dryRun?: boolean;
}

/**
 * Build SQL query for clearing logs.
 * @param options - Command options.
 * @returns SQL query and parameters.
 */
const buildClearQuery = (options: ClearLogsOptions): { sql: string; params: unknown[]; description: string } => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const descriptions: string[] = [];

  if (options.level) {
    conditions.push('level = ?');
    params.push(options.level.toLowerCase());
    descriptions.push(`level=${options.level}`);
  }

  if (options.olderThan) {
    const days = parseInt(options.olderThan, 10);
    if (isNaN(days) || days <= 0) {
      throw new Error('older-than must be a positive number of days');
    }

    conditions.push('timestamp < datetime("now", "-" || ? || " days")');
    params.push(days);
    descriptions.push(`older than ${days} days`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const description = descriptions.length > 0
    ? `logs ${descriptions.join(' and ')}`
    : 'all logs';

  const sql = `DELETE FROM system_logs ${whereClause}`;

  return {
 sql,
params,
description
};
};

/**
 * Get count of logs that would be deleted.
 * @param options - Command options.
 * @param dbService - Database service.
 * @returns Promise that resolves to count of logs.
 */
const getLogCount = async (options: ClearLogsOptions, dbService: DatabaseService): Promise<number> => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.level) {
    conditions.push('level = ?');
    params.push(options.level.toLowerCase());
  }

  if (options.olderThan) {
    const days = parseInt(options.olderThan, 10);
    conditions.push('timestamp < datetime("now", "-" || ? || " days")');
    params.push(days);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM system_logs ${whereClause}`;

  const result = await dbService.query<{ count: number }>(sql, params);
  return result[0]?.count || 0;
};

/**
 * Prompt user for confirmation.
 * @param message - Confirmation message.
 * @returns Promise that resolves to true if confirmed.
 */
const promptConfirmation = async (message: string): Promise<boolean> => {
  return await new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

/**
 * Execute the clear logs command.
 * @param context - CLI context with arguments and flags.
 * @returns Promise that resolves when command completes.
 */
export const execute = async (context: ICLIContext): Promise<void> => {
  try {
    const { args } = context;
    const options: ClearLogsOptions = {
      level: args?.['level'] as string,
      olderThan: args?.['older-than'] as string,
      confirm: args?.['confirm'] as boolean,
      dryRun: args?.['dry-run'] as boolean
    };

    // Validate level if provided
    if (options.level && !['debug', 'info', 'warn', 'error'].includes(options.level.toLowerCase())) {
      throw new Error('Invalid log level. Must be one of: debug, info, warn, error');
    }

    // Get database service
    const dbService = DatabaseService.getInstance();

    // Get count of logs that would be affected
    const logCount = await getLogCount(options, dbService);

    if (logCount === 0) {
      console.log('No logs found matching the criteria.');
      return;
    }

    // Build query
    const {
 sql, params, description
} = buildClearQuery(options);

    // Show what would be done
    console.log(`Found ${logCount} ${description} to clear.`);

    if (options.dryRun) {
      console.log('Dry run mode - no logs were actually deleted.');
      console.log(`Would execute: ${sql}`);
      return;
    }

    // Confirm deletion unless --confirm flag is used
    if (!options.confirm) {
      const confirmed = await promptConfirmation(`Are you sure you want to delete ${logCount} ${description}?`);
      if (!confirmed) {
        console.log('Operation cancelled.');
        return;
      }
    }

    // Execute deletion
    await dbService.execute(sql, params);

    console.log(`Successfully deleted ${logCount} ${description}.`);

    // Show remaining log count
    const remainingCount = await getLogCount({}, dbService);
    console.log(`${remainingCount} logs remaining in database.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CommandExecutionError(
      'logger:clear',
      error instanceof Error ? error : new Error(errorMessage),
      `Failed to clear logs: ${errorMessage}`
    );
  }
};

export default { execute };
