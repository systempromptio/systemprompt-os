/**
 * Show logs CLI command.
 * Command to display recent logs from the database with filtering and paging options.
 * @file Show logs CLI command.
 * @module modules/core/logger/cli/show
 */

import { spawn } from 'child_process';
import { z } from 'zod';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { ISystemLogsRow } from '@/modules/core/logger/types/database.generated';
import { LogSource } from '@/modules/core/logger/types/manual';

// Zod schema for show logs arguments
const showLogsArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  limit: z.coerce.number().positive().max(1000).default(50),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  module: z.string().optional(),
  since: z.string().datetime().optional(),
  pager: z.enum(['true', 'false']).transform(v => v === 'true').default('false')
});

type ShowLogsArgs = z.infer<typeof showLogsArgsSchema>;

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
 * Build WHERE conditions for SQL query with parameters.
 * @param options - Command options.
 * @returns SQL conditions and parameters.
 */
const buildWhereConditions = (options: ShowLogsArgs): { conditions: string[]; params: unknown[] } => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.level !== undefined && options.level !== '') {
    conditions.push('level = ?');
    params.push(options.level.toLowerCase());
  }

  if (options.module !== undefined && options.module !== '') {
    conditions.push('source = ?');
    params.push(options.module);
  }

  if (options.since !== undefined && options.since !== '') {
    conditions.push('timestamp >= ?');
    params.push(options.since);
  }

  return { conditions, params };
};

/**
 * Build SQL query with filters.
 * @param options - Command options.
 * @returns SQL query object with parameters.
 */
const buildQuery = (options: ShowLogsArgs): { sql: string; params: unknown[] } => {
  const { conditions, params } = buildWhereConditions(options);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT id, level, message, args, source, timestamp, category, created_at
    FROM system_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  // Add limit parameter
  params.push(options.limit);

  return { sql, params };
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
  // Fallback to stdout if pager fails
  process.stdout.write(content);
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

// Option extraction is now handled by Zod schema validation

/**
 * Get database service instance.
 * @returns Database service instance.
 */
const getDatabaseService = async (): Promise<{
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}> => {
  const { DatabaseService } = await import('@/modules/core/database/services/database.service');
  return DatabaseService.getInstance();
};

/**
 * Format logs for text output.
 * @param logs - Log entries to format.
 * @returns Formatted output string.
 */
const formatTextOutput = (logs: ISystemLogsRow[]): string => {
  const formattedLogs = logs.reverse().map(formatLogEntry);
  return formattedLogs.join('\n');
};

/**
 * Display output to user via pager or CLI output service.
 * @param output - Content to display.
 * @param usePager - Whether to use pager.
 * @param cliOutput - CLI output service.
 */
const displayTextOutput = async (output: string, usePager: boolean, cliOutput: CliOutputService): Promise<void> => {
  if (usePager && process.stdout.isTTY) {
    await sendToPager(output);
  } else {
    cliOutput.info(output);
  }
};

export const command: ICLICommand = {
  description: 'Show recent logs from database with filtering and paging options',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Number of recent logs to show',
      default: 50
    },
    {
      name: 'level',
      type: 'string',
      description: 'Filter by log level (debug, info, warn, error)'
    },
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Filter by module name'
    },
    {
      name: 'since',
      alias: 's',
      type: 'string',
      description: 'Show logs since timestamp (YYYY-MM-DD HH:MM:SS)'
    },
    {
      name: 'pager',
      alias: 'p',
      type: 'boolean',
      description: 'Use pager for output (less)'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = showLogsArgsSchema.parse(context.args);
      const dbService = await getDatabaseService();
      const { sql, params } = buildQuery(validatedArgs);
      
      const logs: ISystemLogsRow[] = await dbService.query<ISystemLogsRow>(sql, params);

      if (logs.length === 0) {
        if (validatedArgs.format === 'json') {
          cliOutput.json({
            logs: [],
            message: 'No logs found matching the criteria',
            timestamp: new Date().toISOString()
          });
        } else {
          cliOutput.info('No logs found matching the criteria.');
        }
        process.exit(0);
        return;
      }

      if (validatedArgs.format === 'json') {
        // Return full database objects
        cliOutput.json(logs);
      } else {
        const textOutput = formatTextOutput(logs);
        await displayTextOutput(textOutput, validatedArgs.pager, cliOutput);
      }
      
      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        cliOutput.error(`Failed to show logs: ${errorMessage}`);
        logger.error(LogSource.LOGGER, 'Show logs command failed', {
          error: error instanceof Error ? error : new Error(errorMessage)
        });
      }
      process.exit(1);
    }
  }
};
