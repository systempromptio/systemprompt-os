/**
 * Database query CLI command.
 * This module provides functionality to execute SQL queries safely with admin-only access.
 * @file Database query CLI command.
 * @module modules/core/database/cli/query
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseQueryService, type OutputFormat } from '@/modules/core/cli/services/database-query.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import * as readline from 'readline';
import { readFile } from 'fs/promises';

/**
 * Log query results based on format.
 * @param output - Query output lines.
 * @param executionTime - Query execution time.
 * @param context
 * @param format - Output format.
 * @param logger - Logger service instance.
 * @param context.format
 * @param context.logger
 */
const logQueryResults = (
  output: string[],
  executionTime: number,
  context: { format: OutputFormat; logger: LoggerService }
): void => {
  output.forEach((line): void => {
    context.logger.info(LogSource.CLI, line);
  });

  const [firstLine] = output;
  const isTableWithRows = context.format === 'table' && output.length > 1;
  const isValidOutput = firstLine !== undefined
    && firstLine !== '(0 rows)'
    && !firstLine.includes('Query executed successfully');

  if (isTableWithRows && isValidOutput) {
    const rowCount = output.length - 2;
    context.logger.info(LogSource.CLI, `(${String(rowCount)} rows in ${String(executionTime)}ms)`);
  } else if (context.format !== 'table' && isValidOutput) {
    context.logger.info(LogSource.CLI, `Query executed successfully (${String(executionTime)}ms)`);
  }
};

/**
 * Check if query can be executed based on readonly mode.
 * @param context
 * @param queryService - Query service instance.
 * @param query - SQL query.
 * @param readonly - Whether readonly mode is enabled.
 * @param logger - Logger service instance.
 * @param context.queryService
 * @param context.readonly
 * @param context.logger
 * @returns True if query can be executed.
 */
const canExecuteQuery = (
  query: string,
  context: { queryService: DatabaseQueryService; readonly: boolean; logger: LoggerService }
): boolean => {
  if (context.readonly && !context.queryService.isReadOnlyQuery(query)) {
    context.logger.error(LogSource.CLI, 'Error: Only SELECT queries are allowed in readonly mode.');
    context.logger.error(LogSource.CLI, 'Use --readonly=false to execute write queries.');
    return false;
  }
  return true;
};

/**
 * Execute and log a single query.
 * @param query - SQL query to execute.
 * @param context - Query execution context.
 * @param context.queryService
 * @param context.logger
 * @param context.format
 * @param context.readonly
 * @returns Promise that resolves when query is executed.
 */
const executeAndLogQuery = async (
  query: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const {
    queryService,
    logger,
    format
  } = context;
  const { output, executionTime } = await queryService.executeQuery(query, format);
  logQueryResults(output, executionTime, {
 format,
logger
});
};

/**
 * Handle a single line of input in interactive mode.
 * @param input - User input.
 * @param rl - Readline interface.
 * @param context - Query execution context.
 * @param context.queryService
 * @param context.logger
 * @param context.format
 * @param context.readonly
 */
const handleInteractiveLine = async (
  input: string,
  rl: readline.Interface,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const trimmedInput = input.trim();

  if (trimmedInput === '.exit') {
    rl.close();
    return;
  }

  if (trimmedInput === '') {
    rl.prompt();
    return;
  }

  try {
    if (!canExecuteQuery(trimmedInput, context)) {
      rl.prompt();
      return;
    }

    await executeAndLogQuery(trimmedInput, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
  }

  rl.prompt();
};

/**
 * Handle interactive query mode.
 * @param context - Query execution context.
 * @param context.queryService
 * @param context.logger
 * @param context.format
 * @param context.readonly
 * @returns Promise that resolves when interactive mode exits.
 */
const handleInteractiveMode = async (
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'query> '
  });

  context.logger.info(LogSource.CLI, 'Interactive SQL query mode. Type ".exit" to quit.');
  rl.prompt();

  rl.on('line', (input: string): void => {
    handleInteractiveLine(input, rl, context).catch((error): void => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.logger.error(LogSource.CLI, `Interactive mode error: ${errorMessage}`);
    });
  });

  rl.on('close', (): void => {
    context.logger.info(LogSource.CLI, '\nExiting interactive mode.');
    process.exit(0);
  });

  await new Promise<never>(() => {
  });
};

/**
 * Execute queries from a file.
 * @param file - Path to SQL file.
 * @param context - Query execution context.
 * @param context.queryService
 * @param context.logger
 * @param context.format
 * @param context.readonly
 * @returns Promise that resolves when all queries are executed.
 */
const executeFileQueries = async (
  file: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const content = await readFile(file, 'utf-8');
  const queries = context.queryService.parseQueries(content);

  if (queries.length === 0) {
    context.logger.info(LogSource.CLI, 'No queries found in file.');
    return;
  }

  context.logger.info(LogSource.CLI, `Executing ${String(queries.length)} queries from ${String(file)}...\n`);

  for (const query of queries) {
    if (!canExecuteQuery(query, context)) {
      process.exit(1);
      return;
    }

    await executeAndLogQuery(query, context);
    context.logger.info(LogSource.CLI, '');
  }
};

/**
 * Execute a single query.
 * @param sql - SQL query to execute.
 * @param context - Query execution context.
 * @param context.queryService
 * @param context.logger
 * @param context.format
 * @param context.readonly
 * @returns Promise that resolves when query is executed.
 */
const executeSingleQuery = async (
  sql: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  if (!canExecuteQuery(sql, context)) {
    process.exit(1);
    return;
  }

  await executeAndLogQuery(sql, context);
};

/**
 * Parse and validate command arguments.
 * @param args - Command arguments.
 * @returns Parsed arguments.
 */
const parseArguments = (args: Record<string, unknown>): {
  format: OutputFormat;
  readonly: boolean;
  interactive: boolean;
  sql: unknown;
  file: unknown;
} => {
  const format = typeof args.format === 'string'
    && ['table', 'json', 'csv'].includes(args.format)
    ? args.format as OutputFormat : 'table';

  return {
    format,
    readonly: args.readonly !== false,
    interactive: args.interactive === true,
    sql: args.sql,
    file: args.file
  };
};

/**
 * Database query command implementation.
 */
export const command = {
  name: 'query',
  description: 'Execute SQL queries safely (admin only)',
  options: [
    {
      name: 'sql',
      type: 'string' as const,
      description: 'SQL query to execute',
      alias: 's'
    },
    {
      name: 'file',
      type: 'string' as const,
      description: 'Path to SQL file containing queries',
      alias: 'f'
    },
    {
      name: 'format',
      type: 'string' as const,
      description: 'Output format: table, json, csv',
      default: 'table',
      choices: ['table', 'json', 'csv']
    },
    {
      name: 'interactive',
      type: 'boolean' as const,
      description: 'Start interactive query mode',
      alias: 'i'
    },
    {
      name: 'readonly',
      type: 'boolean' as const,
      description: 'Restrict to SELECT queries only',
      default: true
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const queryService = DatabaseQueryService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const isInitialized = await queryService.isInitialized();
      if (!isInitialized) {
        logger.error(LogSource.CLI, "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
        return;
      }

      const {
 format, readonly, interactive, sql, file
} = parseArguments(args);

      if (sql === undefined && file === undefined && !interactive) {
        logger.error(LogSource.CLI, 'Please provide --sql, --file, or --interactive option.');
        process.exit(1);
        return;
      }

      const queryContext = {
        queryService,
        logger,
        format,
        readonly
      };

      if (interactive) {
        await handleInteractiveMode(queryContext);
        return;
      }

      if (typeof file === 'string' && file.length > 0) {
        try {
          await executeFileQueries(file, queryContext);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
          process.exit(1);
          return;
        }
        return;
      }

      if (typeof sql === 'string' && sql.length > 0) {
        try {
          await executeSingleQuery(sql, queryContext);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
          process.exit(1);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
      process.exit(1);
    }
  }
};
