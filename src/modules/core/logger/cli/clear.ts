// LINT-STANDARDS-ENFORCER: Unable to resolve after 9 iterations. Remaining issues: 16 ESLint errors including JSDoc missing param descriptions, unnecessary conditionals, max line length violations, and dynamic import restrictions. TypeScript errors are primarily module resolution issues that should resolve at build time.
/**
 * Clear logs CLI command.
 * @file Clear logs CLI command.
 * @module modules/core/logger/cli/clear
 * @description Command to clear logs from the database with various filtering options.
 */

import { createInterface } from 'readline';
import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type IClearLogsOptions, LogSource } from '@/modules/core/logger/types/index';

/**
 * Validate and process older-than parameter.
 * @param olderThan - Raw older-than value.
 * @returns Parsed days or undefined.
 * @throws {Error} When older-than value is invalid.
 */
const validateOlderThan = (olderThan: string | undefined): number | undefined => {
  if (olderThan === undefined || olderThan === '') {
    return undefined;
  }

  const days = Number.parseInt(olderThan, 10);
  if (Number.isNaN(days) || days <= 0) {
    throw new Error('older-than must be a positive number of days');
  }

  return days;
};

/**
 * Add level condition to query.
 * @param params - Parameters for adding level condition.
 * @param params.options - Clear options.
 * @param params.conditions - Array to push conditions to.
 * @param params.queryParams - Array to push parameters to.
 * @param params.descriptions - Array to push descriptions to.
 */
const addLevelCondition = (params: {
  options: IClearLogsOptions;
  conditions: string[];
  queryParams: unknown[];
  descriptions: string[];
}): void => {
  if (params.options.level !== undefined && params.options.level !== '') {
    params.conditions.push('level = ?');
    params.queryParams.push(params.options.level.toLowerCase());
    params.descriptions.push(`level=${params.options.level}`);
  }
};

/**
 * Add time condition to query.
 * @param params - Parameters for adding time condition.
 * @param params.options - Clear options.
 * @param params.conditions - Array to push conditions to.
 * @param params.queryParams - Array to push parameters to.
 * @param params.descriptions - Array to push descriptions to.
 */
const addTimeCondition = (params: {
  options: IClearLogsOptions;
  conditions: string[];
  queryParams: unknown[];
  descriptions: string[];
}): void => {
  const days = validateOlderThan(params.options.olderThan);
  if (days !== undefined) {
    params.conditions.push('timestamp < datetime("now", "-" || ? || " days")');
    params.queryParams.push(days);
    params.descriptions.push(`older than ${String(days)} days`);
  }
};

/**
 * Build SQL query for clearing logs.
 * @param options - Command options.
 * @returns SQL query and parameters.
 * @throws {Error} When older-than value is invalid.
 */
const buildClearQuery = (
  options: IClearLogsOptions
): { sql: string; params: unknown[]; description: string } => {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  const descriptions: string[] = [];

  addLevelCondition({
 options,
conditions,
queryParams,
descriptions
});
  addTimeCondition({
 options,
conditions,
queryParams,
descriptions
});

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const description = descriptions.length > 0 ? `logs ${descriptions.join(' and ')}` : 'all logs';
  const sql = `DELETE FROM system_logs ${whereClause}`;

  return {
 sql,
params: queryParams,
description
};
};

/**
 * Build count query for logs.
 * @param options - Command options.
 * @returns SQL count query and parameters.
 */
const buildCountQuery = (options: IClearLogsOptions): { sql: string; params: unknown[] } => {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  const descriptions: string[] = [];

  addLevelCondition({
 options,
conditions,
queryParams,
descriptions
});
  addTimeCondition({
 options,
conditions,
queryParams,
descriptions
});

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM system_logs ${whereClause}`;

  return {
 sql,
params: queryParams
};
};

/**
 * Get count of logs that would be deleted.
 * @param options - Command options.
 * @param dbService - Database service.
 * @param dbService.query
 * @returns Promise that resolves to count of logs.
 */
const getLogCount = async (
  options: IClearLogsOptions,
  dbService: { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> }
): Promise<number> => {
  const { sql: countSql, params: countParams } = buildCountQuery(options);
  const result = await dbService.query<{ count: number }>(countSql, countParams);
  return result[0]?.count ?? 0;
};

/**
 * Prompt user for confirmation.
 * @param message - Confirmation message.
 * @returns Promise that resolves to true if confirmed.
 */
const promptConfirmation = async (message: string): Promise<boolean> => {
  return await new Promise<boolean>((resolve): void => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (y/N): `, (answer): void => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

/**
 * Validate log level parameter.
 * @param level - Log level to validate.
 * @throws {Error} When log level is invalid.
 */
const validateLogLevel = (level: string | undefined): void => {
  if (level === undefined || level === '') {
    return;
  }

  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level.toLowerCase())) {
    throw new Error('Invalid log level. Must be one of: debug, info, warn, error');
  }
};

/**
 * Parse and validate command options from CLI context.
 * @param context - CLI context with arguments and flags.
 * @returns Parsed and validated options.
 * @throws {Error} When options are invalid.
 */
const parseOptions = (context: ICLIContext): IClearLogsOptions => {
  const { args } = context;
  if (args === null || args === undefined) {
    const emptyOptions: IClearLogsOptions = {};
    return emptyOptions;
  }

  const options: IClearLogsOptions = {};

  if ('level' in args && typeof args.level === 'string') {
    options.level = args.level;
  }

  if ('older-than' in args && typeof args['older-than'] === 'string') {
    options.olderThan = args['older-than'];
  }

  if ('confirm' in args) {
    options.confirm = Boolean(args.confirm);
  }

  if ('dry-run' in args) {
    options.dryRun = Boolean(args['dry-run']);
  }

  validateLogLevel(options.level);
  return options;
};

/**
 * Handle dry run mode execution.
 * @param params - Dry run parameters.
 * @param params.options - Clear options.
 * @param params.sql - SQL to execute.
 * @param params.logCount - Count of logs to clear.
 * @param params.description - Description of logs to clear.
 */
const handleDryRun = (params: {
  options: IClearLogsOptions;
  sql: string;
  logCount: number;
  description: string;
}): void => {
  if (params.options.dryRun === true) {
    process.stdout.write(`Found ${String(params.logCount)} ${params.description} to clear.\n`);
    process.stdout.write('Dry run mode - no logs were actually deleted.\n');
    process.stdout.write(`Would execute: ${params.sql}\n`);
  }
};

/**
 * Execute actual log clearing operation.
 * @param params - Clear operation parameters.
 * @param params.options - Clear options.
 * @param params.sql - SQL to execute.
 * @param params.sqlParams - SQL parameters.
 * @param params.logCount - Count of logs to clear.
 * @param params.description - Description of logs to clear.
 * @param params.dbInstance - Database service instance.
 * @param params.logger - Logger service instance.
 * @param params.dbInstance.execute
 * @param params.dbInstance.query
 * @returns Promise that resolves when operation completes.
 */
const executeClearOperation = async (params: {
  options: IClearLogsOptions;
  sql: string;
  sqlParams: unknown[];
  logCount: number;
  description: string;
  dbInstance: { execute: (sql: string, params?: unknown[]) => Promise<void>; query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };
  logger: LoggerService;
}): Promise<void> => {
  if (params.options.confirm !== true) {
    const message = `Are you sure you want to delete ${String(params.logCount)} ${params.description}?`;
    const confirmed = await promptConfirmation(message);
    if (!confirmed) {
      process.stdout.write('Operation cancelled.\n');
      return;
    }
  }

  await params.dbInstance.execute(params.sql, params.sqlParams);
  process.stdout.write(`Successfully deleted ${String(params.logCount)} ${params.description}.\n`);

  const remainingCount = await getLogCount({}, params.dbInstance);
  process.stdout.write(`${String(remainingCount)} logs remaining in database.\n`);

  params.logger.info(LogSource.CLI, 'Cleared logs successfully', {
    count: params.logCount,
    description: params.description,
    dryRun: params.options.dryRun
  });
};

/**
 * Get database service instance through logger service.
 * @returns Database service instance.
 * @throws {Error} When database service is not available.
 */
const getDatabaseService = async (): Promise<{
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}> => {
  const { DatabaseService } = await import('@/modules/core/database/services/database.service');
  return DatabaseService.getInstance();
};

/**
 * Execute the main clear logs logic.
 * @param options - Parsed clear options.
 * @param dbInstance - Database service instance.
 * @param dbInstance.execute
 * @param logger - Logger service instance.
 * @param dbInstance.query
 * @returns Promise that resolves when operation completes.
 */
const executeClearLogic = async (
  options: IClearLogsOptions,
  dbInstance: { execute: (sql: string, params?: unknown[]) => Promise<void>; query: <T>(sql: string, params?: unknown[]) => Promise<T[]> },
  logger: LoggerService
): Promise<void> => {
  const logCount = await getLogCount(options, dbInstance);

  if (logCount === 0) {
    process.stdout.write('No logs found matching the criteria.\n');
    return;
  }

  const {
    sql: clearSql,
    params: clearParams,
    description
  } = buildClearQuery(options);

  if (options.dryRun === true) {
    handleDryRun({
      options,
      sql: clearSql,
      logCount,
      description
    });
    return;
  }

  await executeClearOperation({
    options,
    sql: clearSql,
    sqlParams: clearParams,
    logCount,
    description,
    dbInstance,
    logger
  });
};

/**
 * Execute the clear logs command.
 * @param context - CLI context with arguments and flags.
 * @returns Promise that resolves when command completes.
 * @throws {CommandExecutionError} When command execution fails.
 */
export const execute = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();

  try {
    const options = parseOptions(context);
    const dbInstance = await getDatabaseService();
    await executeClearLogic(options, dbInstance, logger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(LogSource.CLI, `Failed to clear logs: ${errorMessage}`, {
      error: error instanceof Error ? error : new Error(errorMessage)
    });
    throw new CommandExecutionError(
      'logger:clear',
      error instanceof Error ? error : new Error(errorMessage),
      `Failed to clear logs: ${errorMessage}`
    );
  }
};

export default { execute };
