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
} from '@/modules/core/cli/services/database-summary.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Output summary in JSON format.
 * @param summary - Database summary data.
 * @param logger - Logger service instance.
 */
const outputJsonFormat = (
  summary: ISummaryResult['data'],
  logger: LoggerService,
): void => {
  if (summary) {
    const jsonOutput = JSON.stringify(summary, null, 2);
    logger.info(LogSource.DATABASE, jsonOutput);
  }
};

/**
 * Output summary in table format.
 * @param summary - Database summary data.
 * @param logger - Logger service instance.
 */
const outputTableFormat = (
  summary: ISummaryResult['data'],
  logger: LoggerService,
): void => {
  if (!summary) {
    return;
  }

  logger.info(LogSource.DATABASE, 'Database Summary');
  logger.info(LogSource.DATABASE, '================');
  logger.info(LogSource.DATABASE, `Total Tables: ${String(summary.totalTables)}`);
  logger.info(
    LogSource.DATABASE,
    `Total Rows: ${summary.totalRows.toLocaleString()}`,
  );
  logger.info(
    LogSource.DATABASE,
    `Average Rows/Table: ${summary.averageRowsPerTable.toLocaleString()}`,
  );
  logger.info(LogSource.DATABASE, '');

  if (summary.tables.length > 0) {
    const maxNameLength = Math.max(
      10,
      ...summary.tables.map((table): number => {
        return table.name.length;
      }),
    );
    const headerLine = `${'Table Name'.padEnd(maxNameLength)} | ${
      'Rows'.padStart(10)
    } | ${'Columns'.padStart(8)}`;
    const separatorLine = '-'.repeat(headerLine.length);

    logger.info(LogSource.DATABASE, headerLine);
    logger.info(LogSource.DATABASE, separatorLine);

    summary.tables.forEach((table): void => {
      const line = `${table.name.padEnd(maxNameLength)} | ${table.rowCount
        .toLocaleString()
        .padStart(10)} | ${String(table.columnCount).padStart(8)}`;
      logger.info(LogSource.DATABASE, line);
    });
  }
};

/**
 * Output summary in text format.
 * @param summary - Database summary data.
 * @param logger - Logger service instance.
 */
const outputTextFormat = (
  summary: ISummaryResult['data'],
  logger: LoggerService,
): void => {
  if (!summary) {
    return;
  }

  logger.info(LogSource.DATABASE, 'Database Summary:');
  logger.info(LogSource.DATABASE, `  Total Tables: ${String(summary.totalTables)}`);
  logger.info(
    LogSource.DATABASE,
    `  Total Rows: ${summary.totalRows.toLocaleString()}`,
  );
  logger.info(
    LogSource.DATABASE,
    `  Average Rows per Table: ${summary.averageRowsPerTable.toLocaleString()}`,
  );
  logger.info(LogSource.DATABASE, '');

  if (summary.tables.length > 0) {
    logger.info(LogSource.DATABASE, 'Tables:');
    summary.tables.forEach((table): void => {
      logger.info(LogSource.DATABASE, `  ${table.name}:`);
      logger.info(
        LogSource.DATABASE,
        `    Rows: ${table.rowCount.toLocaleString()}`,
      );
      logger.info(LogSource.DATABASE, `    Columns: ${String(table.columnCount)}`);
    });
  }
};

/**
 * Handle summary command execution.
 * @param params - Summary parameters.
 * @param logger - Logger service instance.
 */
const handleSummaryExecution = async (
  params: ISummaryParams,
  logger: LoggerService,
): Promise<void> => {
  const summaryService = DatabaseSummaryService.getInstance();
  const result = await summaryService.handleSummary(params);

  if (!result.success) {
    logger.error(LogSource.DATABASE, result.message ?? 'Unknown error');
    process.exit(1);
    return;
  }

  const { format = 'table' } = params;

  if (format === 'json') {
    outputJsonFormat(result.data, logger);
  } else if (format === 'table') {
    outputTableFormat(result.data, logger);
  } else {
    outputTextFormat(result.data, logger);
  }
};

export const command = {
  description: 'Show formatted summary of database tables and statistics',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();

    const formatValue = args.format;
    const format: ISummaryFormatCLI = typeof formatValue === 'string'
      && ['text', 'json', 'table'].includes(formatValue) ? formatValue as ISummaryFormatCLI : 'table';

    const includeSystem = Boolean(args['include-system']);

    const sortByValue = args['sort-by'];
    const sortBy: ISummarySortByCLI = typeof sortByValue === 'string'
      && ['name', 'rows', 'columns'].includes(sortByValue) ? sortByValue as ISummarySortByCLI : 'name';

    const params: ISummaryParams = {
      format,
      includeSystem,
      sortBy,
    };

    try {
      await handleSummaryExecution(params, logger);
    } catch (error) {
      logger.error(LogSource.DATABASE, 'Error getting database summary', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }

    process.exit(0);
  },
};
