/**
 * Database summary CLI command.
 * This module provides functionality to display a formatted summary of database
 * tables and statistics.
 * @file Database summary CLI command.
 * @module modules/core/database/cli/summary
 */

import type {
  ICLIContext,
  ISummaryFormatCLI,
  ISummarySortByCLI,
} from '@/modules/core/cli/types/index';
import {
  DatabaseSummaryService,
  type ISummaryParams,
  type ISummaryResult,
  type ITableInfo,
} from '@/modules/core/database/services/database-summary.service';
import {
  CliOutputService,
  type ITableColumn,
} from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Type guard to check if data has the expected summary structure.
 * @param data
 */
const isSummaryData = (data: any): data is NonNullable<ISummaryResult['data']> => {
  return data && typeof data === 'object'
         && 'timestamp' in data && 'totalTables' in data
         && 'totalRows' in data && 'averageRowsPerTable' in data
         && 'tables' in data && Array.isArray(data.tables);
};

/**
 * Display summary statistics.
 * @param data - Summary data to display.
 * @param cliOutput - CLI output service instance.
 */
const displaySummaryStats = (
  data: NonNullable<ISummaryResult['data']>,
  cliOutput: CliOutputService,
): void => {
  cliOutput.section('Database Summary', `Generated at ${(data as any).timestamp}`);
  cliOutput.keyValue({
    'Total Tables': (data as any).totalTables,
    'Total Rows': (data as any).totalRows.toLocaleString(),
    'Average Rows/Table': (data as any).averageRowsPerTable.toLocaleString(),
  });
};

/**
 * Display tables in table format.
 * @param tables - Array of table information.
 * @param cliOutput - CLI output service instance.
 */
const displayTablesAsTable = (
  tables: ITableInfo[],
  cliOutput: CliOutputService,
): void => {
  cliOutput.section('Tables');
  const columns: ITableColumn[] = [
    {
      key: 'name',
      header: 'Table Name',
      align: 'left'
    },
    {
      key: 'rowCount',
      header: 'Rows',
      align: 'right',
      format: (value): string => {
        return Number(value).toLocaleString();
      }
    },
    {
      key: 'columnCount',
      header: 'Columns',
      align: 'right'
    }
  ];
  cliOutput.table(tables, columns, { format: 'table' });
};

/**
 * Display tables in text format.
 * @param tables - Array of table information.
 * @param cliOutput - CLI output service instance.
 */
const displayTablesAsText = (
  tables: ITableInfo[],
  cliOutput: CliOutputService,
): void => {
  cliOutput.section('Tables');
  tables.forEach((table): void => {
    cliOutput.info(`${table.name}:`);
    cliOutput.keyValue({
      '  Rows': table.rowCount.toLocaleString(),
      '  Columns': table.columnCount
    });
  });
};

/**
 * Process summary result and display output.
 * @param result - Summary result from service.
 * @param params - Summary parameters.
 * @param cliOutput - CLI output service instance.
 */
const processSummaryResult = (
  result: ISummaryResult,
  params: ISummaryParams,
  cliOutput: CliOutputService,
): void => {
  if (!isSummaryData(result.data)) {
    cliOutput.warning('No summary data received or data is malformed');
    process.exit(1);
    return;
  }

  const {data} = result;
  const { format = 'table' } = params;

  if (format === 'json') {
    cliOutput.output(data, { format: 'json' });
    return;
  }

  displaySummaryStats(data, cliOutput);

  if ((data as any).tables.length === 0) {
    cliOutput.info('No tables found in the database.');
    return;
  }

  if (format === 'table') {
    displayTablesAsTable((data as any).tables, cliOutput);
  } else {
    displayTablesAsText((data as any).tables, cliOutput);
  }
};

/**
 * Handle summary command execution.
 * @param params - Summary parameters.
 * @param cliOutput - CLI output service instance.
 * @param logger - Logger service instance.
 */
const handleSummaryExecution = async (
  params: ISummaryParams,
  cliOutput: CliOutputService,
  logger: LoggerService,
): Promise<void> => {
  const summaryService = DatabaseSummaryService.getInstance();

  const { DatabaseService } = await import('@/modules/core/database/services/database.service');
  const databaseService = DatabaseService.getInstance();
  const databaseConnection = await databaseService.getConnection();

  const connectionAdapter = {
    query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
      const result = await databaseConnection.query<T>(sql, params);
      return (result as any).rows;
    }
  };

  const result = await summaryService.handleSummary(params, connectionAdapter);

  if (!result.success) {
    const errorMessage = result.message ?? 'Unknown error';
    cliOutput.error(errorMessage);
    logger.error(LogSource.DATABASE, errorMessage);
    process.exit(1);
    return;
  }

  processSummaryResult(result, params, cliOutput);
};

/**
 * Type guard to check if value is a valid format.
 * @param value - Value to check.
 * @returns True if value is a valid format.
 */
const isValidFormat = (value: string): value is ISummaryFormatCLI => {
  return ['text', 'json', 'table'].includes(value);
};

/**
 * Parse and validate format argument.
 * @param formatValue - Raw format value from args.
 * @returns Validated format value.
 */
const parseFormat = (formatValue: unknown): ISummaryFormatCLI => {
  if (typeof formatValue === 'string' && isValidFormat(formatValue)) {
    return formatValue;
  }
  return 'table';
};

/**
 * Type guard to check if value is a valid sort option.
 * @param value - Value to check.
 * @returns True if value is a valid sort option.
 */
const isValidSortBy = (value: string): value is ISummarySortByCLI => {
  return ['name', 'rows', 'columns'].includes(value);
};

/**
 * Parse and validate sort-by argument.
 * @param sortByValue - Raw sort-by value from args.
 * @returns Validated sort-by value.
 */
const parseSortBy = (sortByValue: unknown): ISummarySortByCLI => {
  if (typeof sortByValue === 'string' && isValidSortBy(sortByValue)) {
    return sortByValue;
  }
  return 'name';
};

export const command = {
  description: 'Show formatted summary of database tables and statistics',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const format = parseFormat(args.format);
    const includeSystem = Boolean(args['include-system']);
    const sortBy = parseSortBy(args['sort-by']);

    const params: ISummaryParams = {
      format,
      includeSystem,
      sortBy,
    };

    try {
      await handleSummaryExecution(params, cliOutput, logger);

      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      cliOutput.error('Error getting database summary');
      logger.error(LogSource.DATABASE, 'Error getting database summary', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  },
};
