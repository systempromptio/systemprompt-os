/**
 * @file Show logs CLI command.
 * @module modules/core/logger/cli/show
 * Command to display recent logs from the database with filtering and paging options.
 */

import { spawn } from 'child_process';
import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { DatabaseService } from '@/modules/core/database/services/database.service';

interface LogEntry {
  id: number;
  level: string;
  message: string;
  args: string | null;
  module: string | null;
  timestamp: string;
  session_id: string | null;
  user_id: string | null;
}

interface ShowLogsOptions {
  limit?: number;
  level?: string;
  module?: string;
  since?: string;
  pager?: boolean;
  format?: string;
}

/**
 * Format a log entry as text.
 * @param entry - Log entry to format.
 * @returns Formatted log line.
 */
const formatLogEntry = (entry: LogEntry): string => {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const module = entry.module ? `[${entry.module}]` : '';
  const args = entry.args ? ` ${entry.args}` : '';

  return `${timestamp} ${level} ${module} ${entry.message}${args}`;
};

/**
 * Build SQL query with filters.
 * @param options - Command options.
 * @returns SQL query and parameters.
 */
const buildQuery = (options: ShowLogsOptions): { sql: string; params: unknown[] } => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.level) {
    conditions.push('level = ?');
    params.push(options.level.toLowerCase());
  }

  if (options.module) {
    conditions.push('module = ?');
    params.push(options.module);
  }

  if (options.since) {
    conditions.push('timestamp >= ?');
    params.push(options.since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit || 50;

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
  await new Promise<void>((resolve, reject) => {
    const pager = spawn('less', ['-R', '-S'], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    pager.stdin.write(content);
    pager.stdin.end();

    pager.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Pager exited with code ${code}`));
      }
    });

    pager.on('error', () => {
      console.log(content);
      resolve();
    });
  });
};

/**
 * Execute the show logs command.
 * @param context - CLI context with arguments and flags.
 * @returns Promise that resolves when command completes.
 */
export const execute = async (context: ICLIContext): Promise<void> => {
  try {
    const { args } = context;
    const options: ShowLogsOptions = {
      limit: args?.limit as number,
      level: args?.level as string,
      module: args?.module as string,
      since: args?.since as string,
      pager: args?.pager as boolean,
      format: args?.format as string || 'text'
    };

    const dbService = DatabaseService.getInstance();

    const { sql, params } = buildQuery(options);
    const logs = await dbService.query<LogEntry>(sql, params);

    if (logs.length === 0) {
      console.log('No logs found matching the criteria.');
      return;
    }

    let output: string;

    if (options.format === 'json') {
      output = JSON.stringify(logs, null, 2);
    } else {
      const formattedLogs = logs.reverse().map(formatLogEntry);
      output = formattedLogs.join('\n');
    }

    if (options.pager && process.stdout.isTTY) {
      await sendToPager(output);
    } else {
      console.log(output);
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
