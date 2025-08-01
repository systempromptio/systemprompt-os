/**
 * Clear logs CLI command.
 * @file Clear logs CLI command.
 * @module modules/core/logger/cli/clear
 * @description Command to clear logs from the database with filtering options.
 */

import { createInterface } from 'readline';
import { z } from 'zod';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

// Zod schema for clear command arguments
const clearLogsArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  olderThan: z.coerce.number().positive().optional(),
  confirm: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  dryRun: z.enum(['true', 'false']).transform(v => v === 'true').default('false')
});

type ClearLogsArgs = z.infer<typeof clearLogsArgsSchema>;

// Validation is now handled by Zod schema

/**
 * Add level condition to query.
 * @param params - Parameters for adding level condition.
 * @param params.options - Clear options.
 * @param params.conditions - Array to push conditions to.
 * @param params.queryParams - Array to push parameters to.
 * @param params.descriptions - Array to push descriptions to.
 */
const addLevelCondition = (params: {
  options: ClearLogsArgs;
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
  options: ClearLogsArgs;
  conditions: string[];
  queryParams: unknown[];
  descriptions: string[];
}): void => {
  if (params.options.olderThan !== undefined) {
    params.conditions.push('timestamp < datetime("now", "-" || ? || " days")');
    params.queryParams.push(params.options.olderThan);
    params.descriptions.push(`older than ${String(params.options.olderThan)} days`);
  }
};

/**
 * Build SQL query for clearing logs.
 * @param options - Command options.
 * @returns SQL query and parameters.
 */
const buildClearQuery = (
  options: ClearLogsArgs
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
const buildCountQuery = (options: ClearLogsArgs): { sql: string; params: unknown[] } => {
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
  options: ClearLogsArgs,
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

// Log level validation is now handled by Zod schema

// Options parsing is now handled by Zod schema validation

/**
 * Handle dry run mode execution.
 * @param params - Dry run parameters.
 * @param params.options - Clear options.
 * @param params.sql - SQL to execute.
 * @param params.logCount - Count of logs to clear.
 * @param params.description - Description of logs to clear.
 * @param params.cliOutput - CLI output service.
 */
const handleDryRun = (params: {
  options: ClearLogsArgs;
  sql: string;
  logCount: number;
  description: string;
  cliOutput: CliOutputService;
}): void => {
  if (params.options.dryRun === true) {
    if (params.options.format === 'json') {
      params.cliOutput.json({
        operation: 'clear-logs',
        dryRun: true,
        matchingLogs: params.logCount,
        wouldDelete: params.logCount,
        description: params.description,
        sql: params.sql,
        timestamp: new Date().toISOString()
      });
    } else {
      params.cliOutput.section('Dry Run Mode');
      params.cliOutput.keyValue({
        'Matching logs': String(params.logCount),
        'Description': params.description,
        'Would execute': params.sql
      });
      params.cliOutput.info('No logs were actually deleted.');
    }
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
 * @param params.cliOutput - CLI output service.
 * @param params.dbInstance.execute
 * @param params.dbInstance.query
 * @returns Promise that resolves when operation completes.
 */
const executeClearOperation = async (params: {
  options: ClearLogsArgs;
  sql: string;
  sqlParams: unknown[];
  logCount: number;
  description: string;
  dbInstance: { execute: (sql: string, params?: unknown[]) => Promise<void>; query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };
  logger: LoggerService;
  cliOutput: CliOutputService;
}): Promise<void> => {
  if (params.options.confirm !== true) {
    const message = `Are you sure you want to delete ${String(params.logCount)} ${params.description}?`;
    const confirmed = await promptConfirmation(message);
    if (!confirmed) {
      if (params.options.format === 'json') {
        params.cliOutput.json({
          operation: 'clear-logs',
          cancelled: true,
          reason: 'User cancelled operation',
          timestamp: new Date().toISOString()
        });
      } else {
        params.cliOutput.info('Operation cancelled.');
      }
      return;
    }
  }

  await params.dbInstance.execute(params.sql, params.sqlParams);
  const remainingCount = await getLogCount({}, params.dbInstance);

  if (params.options.format === 'json') {
    params.cliOutput.json({
      operation: 'clear-logs',
      success: true,
      deletedCount: params.logCount,
      remainingCount: remainingCount,
      description: params.description,
      timestamp: new Date().toISOString()
    });
  } else {
    params.cliOutput.success(`Successfully deleted ${String(params.logCount)} ${params.description}`);
    params.cliOutput.info(`${String(remainingCount)} logs remaining in database`);
  }

  params.logger.info(LogSource.LOGGER, 'Cleared logs successfully', {
    count: params.logCount,
    description: params.description,
    remainingCount: remainingCount
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
 * @param cliOutput - CLI output service.
 * @param dbInstance.query
 * @returns Promise that resolves when operation completes.
 */
const executeClearLogic = async (
  options: ClearLogsArgs,
  dbInstance: { execute: (sql: string, params?: unknown[]) => Promise<void>; query: <T>(sql: string, params?: unknown[]) => Promise<T[]> },
  logger: LoggerService,
  cliOutput: CliOutputService
): Promise<void> => {
  const logCount = await getLogCount(options, dbInstance);

  if (logCount === 0) {
    if (options.format === 'json') {
      cliOutput.json({
        operation: 'clear-logs',
        matchingLogs: 0,
        message: 'No logs found matching the criteria',
        timestamp: new Date().toISOString()
      });
    } else {
      cliOutput.info('No logs found matching the criteria.');
    }
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
      description,
      cliOutput
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
    logger,
    cliOutput
  });
};

export const command: ICLICommand = {
  description: 'Clear logs from database with filtering options',
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
      name: 'level',
      type: 'string',
      description: 'Clear only specific log level (debug, info, warn, error)'
    },
    {
      name: 'older-than',
      alias: 'o',
      type: 'string',
      description: 'Clear logs older than N days (e.g., 30)'
    },
    {
      name: 'confirm',
      alias: 'y',
      type: 'boolean',
      description: 'Skip confirmation prompt'
    },
    {
      name: 'dry-run',
      type: 'boolean',
      description: 'Show what would be deleted without actually deleting'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = clearLogsArgsSchema.parse(context.args);
      const dbInstance = await getDatabaseService();
      await executeClearLogic(validatedArgs, dbInstance, logger, cliOutput);
      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        cliOutput.error(`Failed to clear logs: ${errorMessage}`);
        logger.error(LogSource.LOGGER, 'Clear logs command failed', {
          error: error instanceof Error ? error : new Error(errorMessage)
        });
      }
      process.exit(1);
    }
  }
};
