/**
 * Database query CLI command.
 * This module provides functionality to execute SQL queries safely with admin-only access.
 * @file Database query CLI command.
 * @module modules/core/database/cli/query
 */

/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - JSDoc parameter documentation inconsistencies across multiple functions
 * - File length exceeds 500 lines (currently 538 lines) - requires architectural refactoring
 * - Multiple function complexity violations requiring deeper code restructuring
 * - Type assertion and strict boolean expression issues requiring type system changes
 * - Many formatting issues that would benefit from Prettier configuration
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import {
  DatabaseQueryService,
  type OutputFormat
} from '@/modules/core/cli/services/database-query.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import * as readline from 'readline';
import { readFile } from 'fs/promises';

/**
 * Log query results based on format.
 * @param output - Query output lines.
 * @param executionTime - Query execution time.
 * @param context - Context object containing formatting and logging services.
 * @param context.format - Output format for query results.
 * @param context.logger - Logger service instance.
 * @param context.cliOutput - CLI output service instance.
 */
const logQueryResults = (
  output: string[],
  executionTime: number,
  context: { format: OutputFormat; logger: LoggerService; cliOutput: CliOutputService }
): void => {
  output.forEach((line): void => {
    context.cliOutput.info(line);
    context.logger.info(LogSource.CLI, line);
  });

  const [firstLine] = output;
  const isTableWithRows = context.format === 'table' && output.length > 1;
  const isValidOutput = firstLine !== undefined
    && firstLine !== '(0 rows)'
    && !firstLine.includes('Query executed successfully');

  if (isTableWithRows && isValidOutput) {
    const rowCount = output.length - 2;
    const message = `(${String(rowCount)} rows in ${String(executionTime)}ms)`;
    context.cliOutput.info(message);
    context.logger.info(LogSource.CLI, message);
  } else if (context.format !== 'table' && isValidOutput) {
    const message = `Query executed successfully (${String(executionTime)}ms)`;
    context.cliOutput.info(message);
    context.logger.info(LogSource.CLI, message);
  }
};

/**
 * Check if query can be executed based on readonly mode.
 * @param query - SQL query to validate.
 * @param context - Context object containing query service and configuration.
 * @param context.queryService - Database query service instance.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.logger - Logger service instance.
 * @param context.cliOutput - CLI output service instance.
 * @returns True if query can be executed.
 */
const canExecuteQuery = (
  query: string,
  context: {
    queryService: DatabaseQueryService;
    readonly: boolean;
    logger: LoggerService;
    cliOutput: CliOutputService;
  }
): boolean => {
  if (context.readonly && !context.queryService.isReadOnlyQuery(query)) {
    context.cliOutput.error('Error: Only SELECT queries are allowed in readonly mode.');
    context.cliOutput.error('Use --readonly=false to execute write queries.');
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
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.cliOutput - CLI output service instance.
 * @returns Promise that resolves when query is executed.
 */
const executeAndLogQuery = async (
  query: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const {
    queryService,
    logger,
    cliOutput,
    format
  } = context;
  const { output, executionTime } = await queryService.executeQuery(query, format);
  logQueryResults(output, executionTime, {
    format,
    logger,
    cliOutput
  });
};

/**
 * Process user input in interactive mode.
 * @param trimmedInput - Trimmed user input.
 * @param context - Query execution context.
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.cliOutput - CLI output service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @returns Promise that resolves when input is processed.
 */
const processInteractiveInput = async (
  trimmedInput: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  if (!canExecuteQuery(trimmedInput, context)) {
    return;
  }

  await executeAndLogQuery(trimmedInput, context);
};

/**
 * Handle a single line of input in interactive mode.
 * @param input - User input.
 * @param rl - Readline interface.
 * @param context - Query execution context.
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.cliOutput - CLI output service instance.
 */
const handleInteractiveLine = async (
  input: string,
  rl: readline.Interface,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
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
    await processInteractiveInput(trimmedInput, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.cliOutput.error(`Query failed: ${errorMessage}`);
    context.logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
  }

  rl.prompt();
};

/**
 * Handle interactive query mode.
 * @param context - Query execution context.
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.cliOutput - CLI output service instance.
 * @returns Promise that resolves when interactive mode exits.
 */
const handleInteractiveMode = async (
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'query> '
  });

  context.cliOutput.info('Interactive SQL query mode. Type ".exit" to quit.');
  context.logger.info(LogSource.CLI, 'Interactive SQL query mode. Type ".exit" to quit.');
  rl.prompt();

  rl.on('line', (input: string): void => {
    handleInteractiveLine(input, rl, context).catch((error: unknown): void => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.cliOutput.error(`Interactive mode error: ${errorMessage}`);
      context.logger.error(LogSource.CLI, `Interactive mode error: ${errorMessage}`);
    });
  });

  rl.on('close', (): void => {
    context.cliOutput.info('\nExiting interactive mode.');
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
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.cliOutput - CLI output service instance.
 * @returns Promise that resolves when all queries are executed.
 */
const executeFileQueries = async (
  file: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const content = await readFile(file, 'utf-8');
  const queries = context.queryService.parseQueries(content);

  if (queries.length === 0) {
    context.cliOutput.info('No queries found in file.');
    context.logger.info(LogSource.CLI, 'No queries found in file.');
    return;
  }

  context.cliOutput.info(
    `Executing ${String(queries.length)} queries from ${String(file)}...\n`
  );
  context.logger.info(
    LogSource.CLI,
    `Executing ${String(queries.length)} queries from ${String(file)}...`
  );

  for (const query of queries) {
    if (!canExecuteQuery(query, context)) {
      process.exit(1);
      return;
    }

    await executeAndLogQuery(query, context);
    context.cliOutput.info('');
    context.logger.info(LogSource.CLI, '');
  }
};

/**
 * Execute a single query.
 * @param sql - SQL query to execute.
 * @param context - Query execution context.
 * @param context.queryService - Database query service instance.
 * @param context.logger - Logger service instance.
 * @param context.format - Output format for query results.
 * @param context.readonly - Whether readonly mode is enabled.
 * @param context.cliOutput - CLI output service instance.
 * @returns Promise that resolves when query is executed.
 */
const executeSingleQuery = async (
  sql: string,
  context: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
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
  const validFormats: OutputFormat[] = ['table', 'json', 'csv'];
  const format = typeof args.format === 'string' && validFormats.includes(args.format as OutputFormat)
    ? (args.format as OutputFormat)
    : 'table';

  return {
    format,
    readonly: args.readonly !== false,
    interactive: args.interactive === true,
    sql: args.sql,
    file: args.file
  };
};

/**
 * Initialize and validate database services for query execution.
 * @param context
 * @param _context
 */
const initializeQueryServices = async (_context: ICLIContext): Promise<{
  queryService: DatabaseQueryService;
  logger: LoggerService;
  cliOutput: CliOutputService;
} | null> => {
  const queryService = DatabaseQueryService.getInstance();
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  const isInitialized = await queryService.isInitialized();
  if (!isInitialized) {
    const message = "Database is not initialized. "
      + "Run 'systemprompt database:schema --action=init' to initialize.";
    cliOutput.error(message);
    logger.error(LogSource.CLI, message);
    process.exit(1);
    return null;
  }

  return {
 queryService,
logger,
cliOutput
};
};

/**
 * Validate command arguments to ensure at least one execution mode is provided.
 * @param args
 * @param args.sql
 * @param args.file
 * @param args.interactive
 * @param cliOutput
 * @param logger
 */
const validateCommandArguments = (
  args: { sql: unknown; file: unknown; interactive: boolean },
  cliOutput: CliOutputService,
  logger: LoggerService
): boolean => {
  if (args.sql === undefined && args.file === undefined && !args.interactive) {
    const message = 'Please provide --sql, --file, or --interactive option.';
    cliOutput.error(message);
    logger.error(LogSource.CLI, message);
    process.exit(1);
    return false;
  }
  return true;
};

/**
 * Execute queries based on provided arguments.
 * @param error
 * @param cliOutput
 * @param logger
 */
const handleQueryExecutionError = (
  error: unknown,
  cliOutput: CliOutputService,
  logger: LoggerService
): void => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  cliOutput.error(`Query failed: ${errorMessage}`);
  logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
  process.exit(1);
};

const executeQueryCommand = async (
  args: { sql: unknown; file: unknown; interactive: boolean },
  queryContext: {
    queryService: DatabaseQueryService;
    logger: LoggerService;
    cliOutput: CliOutputService;
    format: OutputFormat;
    readonly: boolean;
  }
): Promise<void> => {
  const { cliOutput, logger } = queryContext;

  if (args.interactive) {
    await handleInteractiveMode(queryContext);
    return;
  }

  if (typeof args.file === 'string' && args.file.length > 0) {
    try {
      await executeFileQueries(args.file, queryContext);
    } catch (error) {
      handleQueryExecutionError(error, cliOutput, logger);
    }
    return;
  }

  if (typeof args.sql === 'string' && args.sql.length > 0) {
    try {
      await executeSingleQuery(args.sql, queryContext);
    } catch (error) {
      handleQueryExecutionError(error, cliOutput, logger);
    }
  }
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
    try {
      const services = await initializeQueryServices(context);
      if (!services) {
        return;
      }

      const {
        queryService,
        logger,
        cliOutput
      } = services;
      const parsedArgs = parseArguments(context.args);

      if (!validateCommandArguments(parsedArgs, cliOutput, logger)) {
        return;
      }

      const queryContext = {
        queryService,
        logger,
        cliOutput,
        format: parsedArgs.format,
        readonly: parsedArgs.readonly
      };

      await executeQueryCommand(parsedArgs, queryContext);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const cliOutput = CliOutputService.getInstance();
      const logger = LoggerService.getInstance();
      cliOutput.error(`Query failed: ${errorMessage}`);
      logger.error(LogSource.CLI, `Query failed: ${errorMessage}`);
      process.exit(1);
    }
  }
};
