/**
 * Show logs CLI command.
 * Command to display recent logs from the database with filtering and paging options.
 * @file Show logs CLI command.
 * @module modules/core/logger/cli/show
 */

import { spawn } from 'child_process';
import type { ICLIContext } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { IShowLogsOptions } from '@/modules/core/logger/types/log-entry.types';
import type { ISystemLogsRow } from '@/modules/core/logger/types/database.generated';
import { DatabaseQueryService } from '@/modules/core/cli/services/database-query.service';
import { LogSource } from '@/modules/core/logger/types';

/**
 * Format a log entry as text.
 * @param entry - Log entry to format.
 * @returns Formatted log line.
 */
const formatLogEntry = (entry: ISystemLogsRow): string => {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const moduleStr = entry.source !== null && entry.source !== '' ? `[${entry.source}]` : '';
  const argsStr = entry.args !== null && entry.args !== '' ? ` ${entry.args}` : '';

  return `${timestamp} ${level} ${moduleStr} ${entry.message}${argsStr}`;
};

/**
 * Build WHERE conditions for SQL query.
 * @param options - Command options.
 * @returns SQL conditions.
 */
const buildWhereConditions = (options: IShowLogsOptions): { conditions: string[] } => {
  const conditions: string[] = [];

  if (options.level !== undefined && options.level !== '') {
    conditions.push(`level = '${options.level.toLowerCase()}'`);
  }

  if (options.module !== undefined && options.module !== '') {
    conditions.push(`source = '${options.module}'`);
  }

  if (options.since !== undefined && options.since !== '') {
    conditions.push(`timestamp >= '${options.since}'`);
  }

  return { conditions };
};

/**
 * Build SQL query with filters.
 * @param options - Command options.
 * @returns SQL query object.
 */
const buildQuery = (options: IShowLogsOptions): { sql: string } => {
  const { conditions } = buildWhereConditions(options);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 50;

  const sql = `
    SELECT id, level, message, args, source, timestamp, category, created_at
    FROM system_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ${String(limit)}
  `;

  return { sql };
};

/**
 * Handle pager close event.
 * @param code - Exit code.
 * @param resolve - Promise resolve function.
 * @param reject - Promise reject function.
 */
const handlePagerClose = (
  code: number | null,
  resolve: () => void,
  reject: (error: Error) => void
): void => {
  if (code === 0 || code === null) {
    resolve();
  } else {
    reject(new Error(`Pager exited with code ${String(code)}`));
  }
};

/**
 * Handle pager error event.
 * @param content - Content to display.
 * @param resolve - Promise resolve function.
 */
const handlePagerError = (content: string, resolve: () => void): void => {
  const logger = LoggerService.getInstance();
  logger.info(LogSource.LOGGER, content);
  resolve();
};

/**
 * Send output through pager (less).
 * @param content - Content to page.
 * @returns Promise that resolves when pager closes.
 */
const sendToPager = async (content: string): Promise<void> => {
  await new Promise<void>((resolve, reject): void => {
    const pager = spawn('less', ['-R', '-S'], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    pager.stdin.write(content);
    pager.stdin.end();

    pager.on('close', (code: number | null): void => {
      handlePagerClose(code, resolve, reject);
    });

    pager.on('error', (): void => {
      handlePagerError(content, resolve);
    });
  });
};

/**
 * Extract numeric option from arguments.
 * @param args - CLI arguments.
 * @param key - Option key.
 * @returns Numeric value or undefined.
 */
const extractNumericOption = (args: Record<string, unknown>, key: string): number | undefined => {
  const { [key]: value } = args;
  return typeof value === 'number' ? value : undefined;
};

/**
 * Extract string option from arguments.
 * @param args - CLI arguments.
 * @param key - Option key.
 * @returns String value or undefined.
 */
const extractStringOption = (args: Record<string, unknown>, key: string): string | undefined => {
  const { [key]: value } = args;
  return typeof value === 'string' ? value : undefined;
};

/**
 * Extract boolean option from arguments.
 * @param args - CLI arguments.
 * @param key - Option key.
 * @returns Boolean value or undefined.
 */
const extractBooleanOption = (args: Record<string, unknown>, key: string): boolean | undefined => {
  const { [key]: value } = args;
  return typeof value === 'boolean' ? value : undefined;
};

/**
 * Extract format option with validation.
 * @param args - CLI arguments.
 * @returns Format value or 'text' default.
 */
const extractFormatOption = (args: Record<string, unknown>): 'text' | 'json' => {
  const format = extractStringOption(args, 'format');
  return format === 'json' ? 'json' : 'text';
};

/**
 * Extract and validate options from CLI context.
 * @param context - CLI context.
 * @returns Validated options.
 */
const extractOptions = (context: ICLIContext): IShowLogsOptions => {
  const { args } = context;

  const options: IShowLogsOptions = {};

  const format = extractFormatOption(args);
  if (format !== undefined) {
    options.format = format;
  }

  const limit = extractNumericOption(args, 'limit');
  if (limit !== undefined) {
    options.limit = limit;
  }

  const level = extractStringOption(args, 'level');
  if (level !== undefined) {
    options.level = level;
  }

  const module = extractStringOption(args, 'module');
  if (module !== undefined) {
    options.module = module;
  }

  const since = extractStringOption(args, 'since');
  if (since !== undefined) {
    options.since = since;
  }

  const pager = extractBooleanOption(args, 'pager');
  if (pager !== undefined) {
    options.pager = pager;
  }

  return options;
};

/**
 * Get database query service for CLI operations.
 * @returns Database query service instance.
 */
const getDatabaseQueryService = (): DatabaseQueryService => {
  return DatabaseQueryService.getInstance();
};

/**
 * Format logs based on output format.
 * @param logs - Log entries to format.
 * @param format - Output format.
 * @returns Formatted output string.
 */
const formatOutput = (logs: ISystemLogsRow[], format?: string): string => {
  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  }
  const formattedLogs = logs.reverse().map(formatLogEntry);
  return formattedLogs.join('\n');
};

/**
 * Display output to user via pager or logger.
 * @param output - Content to display.
 * @param usePager - Whether to use pager.
 */
const displayOutput = async (output: string, usePager: boolean): Promise<void> => {
  if (usePager && process.stdout.isTTY) {
    await sendToPager(output);
  } else {
    const logger = LoggerService.getInstance();
    logger.info(LogSource.LOGGER, output);
  }
};

/**
 * Execute the show logs command.
 * @param context - CLI context.
 */
export const execute = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  try {
    const options = extractOptions(context);
    const dbQueryService = getDatabaseQueryService();
    const { sql } = buildQuery(options);
    const queryResult = await dbQueryService.executeQuery(sql, 'json');

    if (queryResult.output.length === 0 || queryResult.output[0] === '(0 rows)') {
      logger.info(LogSource.LOGGER, 'No logs found matching the criteria.');
      return;
    }

    const logs: ISystemLogsRow[] = JSON.parse(queryResult.output[0] ?? '[]');
    const output = formatOutput(logs, options.format);
    await displayOutput(output, options.pager === true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CommandExecutionError(
      'logger:show',
      error instanceof Error ? error : new Error(errorMessage),
      `Failed to show logs: ${errorMessage}`
    );
  }
};

export default {
  execute
};
