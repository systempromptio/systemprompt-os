/**
 * @file Show logs CLI command.
 * @module modules/core/logger/cli/show
 * @description Command to display recent logs from the database with filtering and paging options.
 */

import { spawn } from 'child_process';
import type { ICLIContext } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { ILogEntry as ILogEntryDatabase, IShowLogsOptions } from '@/modules/core/logger/types/log-entry.types';
import type { IDatabaseService } from '@/modules/core/database/types/db-service.interface';
import { LogSource } from '@/modules/core/logger/types';

/**
 * Format a log entry as text.
 * @param entry - Log entry to format.
 * @returns Formatted log line.
 */
const formatLogEntry = (entry: ILogEntryDatabase): string => {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const moduleStr = entry.module !== null && entry.module !== '' ? `[${entry.module}]` : '';
  const argsStr = entry.args !== null && entry.args !== '' ? ` ${entry.args}` : '';

  return `${timestamp} ${level} ${moduleStr} ${entry.message}${argsStr}`;
};

/**
 * Build SQL query with filters.
 * @param options - Command options.
 * @returns SQL query and parameters.
 */
const buildQuery = (options: IShowLogsOptions): { sql: string; params: unknown[] } => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.level !== undefined && options.level !== '') {
    conditions.push('level = ?');
    params.push(options.level.toLowerCase());
  }

  if (options.module !== undefined && options.module !== '') {
    conditions.push('module = ?');
    params.push(options.module);
  }

  if (options.since !== undefined && options.since !== '') {
    conditions.push('timestamp >= ?');
    params.push(options.since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 50;

  const sql = `
    SELECT id, level, message, args, module, timestamp, session_id, user_id
    FROM system_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  params.push(limit);

  return {
    sql,
    params
  };
};

/**
 * Send output through pager (less).
 * @param content - Content to page.
 * @returns Promise that resolves when pager closes.
 */
const sendToPager = async (content: string): Promise<void> => {
  const logger = LoggerService.getInstance();
  await new Promise<void>((resolve, reject) => {
    const pager = spawn('less', ['-R', '-S'], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    pager.stdin.write(content);
    pager.stdin.end();

    pager.on('close', (code: number | null): void => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Pager exited with code ${String(code)}`));
      }
    });

    pager.on('error', (): void => {
      logger.info(LogSource.LOGGER, content);
      resolve();
    });
  });
};

/**
 * Extract and validate options from CLI context.
 * @param context - CLI context.
 * @returns Validated options.
 */
const extractOptions = (context: ICLIContext): IShowLogsOptions => {
  const { args } = context;
  if (!args) {
    return { format: 'text' };
  }

  const options: IShowLogsOptions = {
    format: 'text'
  };

  if (typeof args.limit === 'number') {
    options.limit = args.limit;
  }
  if (typeof args.level === 'string') {
    options.level = args.level;
  }
  if (typeof args.module === 'string') {
    options.module = args.module;
  }
  if (typeof args.since === 'string') {
    options.since = args.since;
  }
  if (typeof args.pager === 'boolean') {
    options.pager = args.pager;
  }
  if (typeof args.format === 'string' && (args.format === 'text' || args.format === 'json')) {
    options.format = args.format;
  }

  return options;
};

/**
 * Get database service from database module.
 * @returns Database service instance.
 */
const getDatabaseService = async (): Promise<IDatabaseService> => {
  const { DatabaseService } = await import('@/modules/core/database/services/database.service');
  return DatabaseService.getInstance();
};

export const execute = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  try {
    const options = extractOptions(context);

    const dbService = await getDatabaseService();
    const { sql, params } = buildQuery(options);

    const logs = await dbService.query<ILogEntryDatabase>(sql, params);

    if (logs.length === 0) {
      logger.info(LogSource.LOGGER, 'No logs found matching the criteria.');
      return;
    }

    let output: string;

    if (options.format === 'json') {
      output = JSON.stringify(logs, null, 2);
    } else {
      const formattedLogs = logs.reverse().map(formatLogEntry);
      output = formattedLogs.join('\n');
    }

    if (options.pager === true && process.stdout.isTTY) {
      await sendToPager(output);
    } else {
      logger.info(LogSource.LOGGER, output);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CommandExecutionError(
      'logger:show',
      error instanceof Error ? error : new Error(errorMessage),
      `Failed to show logs: ${errorMessage}`
    );
  }
};

export default { execute };
