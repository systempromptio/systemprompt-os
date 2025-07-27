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
} from '@/modules/core/cli/services/database-summary.service';
import { CliOutputService, type ITableColumn } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

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
  const result = await summaryService.handleSummary(params);

  if (!result.success) {
    cliOutput.error(result.message ?? 'Unknown error');
    logger.error(LogSource.DATABASE, result.message ?? 'Unknown error');
    process.exit(1);
    return;
  }

  if (!result.data) {
    cliOutput.warning('No summary data received');
    process.exit(1);
    return;
  }

  const { format = 'table' } = params;

  if (format === 'json') {
    cliOutput.output(result.data, { format: 'json' });
    return;
  }

  cliOutput.section('Database Summary', `Generated at ${result.data.timestamp}`);

  cliOutput.keyValue({
    'Total Tables': result.data.totalTables,
    'Total Rows': result.data.totalRows.toLocaleString(),
    'Average Rows/Table': result.data.averageRowsPerTable.toLocaleString(),
  });

  if (result.data.tables.length === 0) {
    cliOutput.info('No tables found in the database.');
    return;
  }

  if (format === 'table') {
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
        format: (value) => { return Number(value).toLocaleString() }
      },
      {
        key: 'columnCount',
        header: 'Columns',
        align: 'right'
      }
    ];

    cliOutput.table(result.data.tables, columns, { format: 'table' });
  } else {
    cliOutput.section('Tables');
    result.data.tables.forEach(table => {
      cliOutput.info(`${table.name}:`);
      cliOutput.keyValue({
        '  Rows': table.rowCount.toLocaleString(),
        '  Columns': table.columnCount
      });
    });
  }
};

export const command = {
  description: 'Show formatted summary of database tables and statistics',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

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
      await handleSummaryExecution(params, cliOutput, logger);
    } catch (error) {
      cliOutput.error('Error getting database summary');
      logger.error(LogSource.DATABASE, 'Error getting database summary', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }

    process.exit(0);
  },
};
