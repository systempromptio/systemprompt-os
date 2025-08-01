/**
 * Database view CLI command.
 * This command provides functionality to view and inspect database table contents,
 * including schema information, data rows, and various output formats.
 * @file Database view CLI command.
 * @module modules/core/database/cli/view
 */

import type { ICLIContext } from '@/modules/core/cli/types/manual';
import {
  DatabaseViewService,
  type IColumnInfo,
  type IViewResult,
} from '@/modules/core/cli/services/database-view.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import type {
  IViewArgs,
  ViewFormat,
} from '@/modules/core/database/cli/types/view.types';

/**
 * Parse and validate numeric parameters.
 * @param value - The value to parse.
 * @param defaultValue - Default value if parsing fails.
 * @returns Parsed number.
 */
const parseNumericParam = (
  value: number | string | undefined,
  defaultValue: number,
): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

/**
 * Validate table name parameter.
 * @param tableName - The table name to validate.
 * @returns True if valid.
 */
const validateTableName = (
  tableName: string | undefined,
): tableName is string => {
  return typeof tableName === 'string' && tableName.trim() !== '';
};

/**
 * Display schema information in table format.
 * @param tableName - The table name.
 * @param columnInfo - Column information array.
 * @param logger - Logger instance.
 */
const displaySchemaTable = (
  tableName: string,
  columnInfo: IColumnInfo[],
  logger: LoggerService,
): void => {
  logger.info(LogSource.CLI, `Table: ${tableName}`);
  logger.info(LogSource.CLI, 'Schema:');
  logger.info(LogSource.CLI, '-------');

  const maxNameLength = Math.max(
    10,
    ...columnInfo.map((column): number => {
      return column.name.length;
    }),
  );
  const maxTypeLength = Math.max(
    8,
    ...columnInfo.map((column): number => {
      return column.type.length;
    }),
  );

  const header = [
    'Column'.padEnd(maxNameLength),
    'Type'.padEnd(maxTypeLength),
    'Null'.padEnd(8),
    'Key'.padEnd(8),
    'Default',
  ].join(' | ');
  logger.info(LogSource.CLI, header);
  logger.info(LogSource.CLI, '-'.repeat(header.length));

  columnInfo.forEach((col): void => {
    const nullable = col.nullable ? 'YES' : 'NO';
    const key = col.primaryKey ? 'PRIMARY' : '';
    const defaultVal = col.defaultValue ?? '';
    const line = [
      col.name.padEnd(maxNameLength),
      col.type.padEnd(maxTypeLength),
      nullable.padEnd(8),
      key.padEnd(8),
      defaultVal,
    ].join(' | ');
    logger.info(LogSource.CLI, line);
  });
};

/**
 * Display data in CSV format.
 * @param rows - Data rows.
 * @param logger - Logger instance.
 */
const displayDataCsv = (rows: unknown[], logger: LoggerService): void => {
  if (rows.length === 0) {
    return;
  }

  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return;
  }
  const columnNames = Object.keys(firstRow);
  logger.info(LogSource.CLI, columnNames.join(','));

  rows.forEach((row): void => {
    const values = columnNames.map((columnName): string => {
      if (!row || typeof row !== 'object') {
        return '';
      }
      const rowRecord = row as Record<string, unknown>;
      const { [columnName]: value } = rowRecord;
      if (
        typeof value === 'string'
        && (value.includes(',') || value.includes('"'))
      ) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    logger.info(LogSource.CLI, values.join(','));
  });
};

/**
 * Calculate column widths for table display.
 * @param rows - Data rows.
 * @param columnNames - Column names.
 * @returns Array of column widths.
 */
const calculateColumnWidths = (
  rows: unknown[],
  columnNames: string[],
): number[] => {
  return columnNames.map((name): number => {
    const maxValueLength = Math.max(
      ...rows.map((row): number => {
        if (!row || typeof row !== 'object') {
          return 0;
        }
        const rowRecord = row as Record<string, unknown>;
        const { [name]: value } = rowRecord;
        if (value === null || value === undefined) {
          return 0;
        }
        if (typeof value === 'object') {
          return JSON.stringify(value).length;
        }
        return String(value).length;
      }),
    );
    return Math.max(name.length, maxValueLength, 4);
  });
};

/**
 * Display table header.
 * @param columnNames - Column names.
 * @param columnWidths - Column widths.
 * @param logger - Logger instance.
 */
const displayTableHeader = (
  columnNames: string[],
  columnWidths: number[],
  logger: LoggerService,
): void => {
  const headerLine = columnNames
    .map((name, index): string => {
      return name.padEnd(columnWidths[index] ?? 0);
    })
    .join(' | ');
  logger.info(LogSource.CLI, headerLine);
  logger.info(LogSource.CLI, '-'.repeat(headerLine.length));
};

/**
 * Display data in table format.
 * @param params - Table display parameters.
 * @param params.tableName - Name of the table being displayed.
 * @param params.rows - Array of data rows to display.
 * @param params.totalRows - Total number of rows in the table.
 * @param params.offset - Current offset in pagination.
 * @param params.limit - Maximum number of rows to display.
 * @param params.hasMore - Whether more rows are available.
 * @param logger - Logger instance.
 */
const displayDataTable = (
  params: {
    tableName: string;
    rows: unknown[];
    totalRows: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  },
  logger: LoggerService,
): void => {
  const {
 tableName, rows, totalRows, offset, limit, hasMore
} = params;

  logger.info(LogSource.CLI, `Table: ${tableName}`);
  const offsetText = offset > 0 ? ` (offset: ${String(offset)})` : '';
  logger.info(
    LogSource.CLI,
    `Showing ${String(rows.length)} of ${totalRows.toLocaleString()} rows${offsetText}`,
  );

  if (rows.length === 0) {
    logger.info(LogSource.CLI, '\nNo results found.');
    return;
  }

  logger.info(LogSource.CLI, '');

  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return;
  }
  const columnNames = Object.keys(firstRow);
  const columnWidths = calculateColumnWidths(rows, columnNames);
  displayTableHeader(columnNames, columnWidths, logger);

  rows.forEach((row): void => {
    const line = columnNames
      .map((name, index): string => {
        if (!row || typeof row !== 'object') {
          return ''.padEnd(columnWidths[index] ?? 0);
        }
        const rowRecord = row as Record<string, unknown>;
        const { [name]: value } = rowRecord;
        let stringValue = '';
        if (value !== null && value !== undefined) {
          stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return stringValue.padEnd(columnWidths[index] ?? 0);
      })
      .join(' | ');
    logger.info(LogSource.CLI, line);
  });

  if (hasMore) {
    logger.info(LogSource.CLI, '');
    const remainingRows = totalRows - offset - rows.length;
    logger.info(
      LogSource.CLI,
      `... ${String(remainingRows)} more rows available`,
    );
    logger.info(
      LogSource.CLI,
      `Use --offset ${String(offset + limit)} to see more`,
    );
  }
};

/**
 * Handle view result processing and display.
 * @param result - View result object.
 * @param format - Output format.
 * @param logger - Logger instance.
 * @param cliOutput - CLI output service instance.
 */
const processViewResult = (
  result: IViewResult,
  format: ViewFormat,
  logger: LoggerService,
  cliOutput: CliOutputService,
): void => {
  if (!result.success) {
    logger.error(LogSource.CLI, result.message ?? 'Unknown error occurred');
    process.exit(1);
  }

  if (result.schema !== undefined) {
    if (format === 'json') {
      cliOutput.json(result.schema);
    } else {
      displaySchemaTable(result.schema.table, result.schema.columns, logger);
    }
    return;
  }

  if (result.data === undefined) {
    logger.error(LogSource.CLI, 'No results returned from view operation');
    process.exit(1);
  }

  if (format === 'json') {
    cliOutput.json(result.data);
  } else if (format === 'csv') {
    displayDataCsv(result.data.data, logger);
  } else {
    displayDataTable(
      {
        tableName: result.data.table,
        rows: result.data.data,
        totalRows: result.data.totalRows,
        offset: result.data.offset,
        limit: result.data.limit,
        hasMore: result.data.hasMore,
      },
      logger,
    );
  }
};

/**
 * Extract and validate view arguments from context.
 * @param context - CLI context.
 * @returns Validated view arguments.
 */
const extractViewArgs = (context: ICLIContext): IViewArgs => {
  const { args } = context;
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid CLI arguments');
  }

  const viewArgs = args;

  const result: IViewArgs = {};

  if (typeof viewArgs.table === 'string') {
    result.table = viewArgs.table;
  }
  if (viewArgs.format === 'table' || viewArgs.format === 'json' || viewArgs.format === 'csv') {
    result.format = viewArgs.format;
  }
  if (typeof viewArgs.limit === 'number' || typeof viewArgs.limit === 'string') {
    result.limit = viewArgs.limit;
  }
  if (typeof viewArgs.offset === 'number' || typeof viewArgs.offset === 'string') {
    result.offset = viewArgs.offset;
  }
  if (typeof viewArgs.columns === 'string') {
    result.columns = viewArgs.columns;
  }
  if (typeof viewArgs.where === 'string') {
    result.where = viewArgs.where;
  }
  if (typeof viewArgs.orderBy === 'string') {
    result.orderBy = viewArgs.orderBy;
  }
  if (typeof viewArgs.schemaOnly === 'boolean') {
    result.schemaOnly = viewArgs.schemaOnly;
  }

  return result;
};

/**
 * Build view parameters for database service.
 * @param args - View arguments.
 * @param args.tableName
 * @param args.format
 * @param args.limit
 * @param args.offset
 * @param args.columns
 * @param args.where
 * @param args.orderBy
 * @param args.schemaOnly
 * @returns Database view parameters.
 */
const buildViewParams = (args: {
  tableName: string;
  format: ViewFormat;
  limit: number;
  offset: number;
  columns?: string;
  where?: string;
  orderBy?: string;
  schemaOnly?: boolean;
}): {
  tableName: string;
  format?: 'table' | 'json' | 'csv';
  limit?: number;
  offset?: number;
  columns?: string;
  where?: string;
  orderBy?: string;
  schemaOnly?: boolean;
} => {
  const viewParams: {
    tableName: string;
    format?: 'table' | 'json' | 'csv';
    limit?: number;
    offset?: number;
    columns?: string;
    where?: string;
    orderBy?: string;
    schemaOnly?: boolean;
  } = {
    tableName: args.tableName,
    format: args.format,
    limit: args.limit,
    offset: args.offset,
  };

  if (args.columns !== undefined) {
    viewParams.columns = args.columns;
  }
  if (args.where !== undefined) {
    viewParams.where = args.where;
  }
  if (args.orderBy !== undefined) {
    viewParams.orderBy = args.orderBy;
  }
  if (args.schemaOnly !== undefined) {
    viewParams.schemaOnly = args.schemaOnly;
  }

  return viewParams;
};

/**
 * Main execute function for the view command.
 * @param context - CLI context containing arguments and configuration.
 */
const executeViewCommand = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  const {
    table: tableName,
    format,
    limit: limitParam,
    offset: offsetParam,
    columns,
    where,
    orderBy,
    schemaOnly,
  } = extractViewArgs(context);

  const viewFormat = format ?? 'table';
  const limit = parseNumericParam(limitParam, 50);
  const offset = parseNumericParam(offsetParam, 0);

  if (!validateTableName(tableName)) {
    logger.error(LogSource.CLI, 'Error: Table name is required');
    logger.info(
      LogSource.CLI,
      'Usage: systemprompt database:view --table <table_name>',
    );
    process.exit(1);
  }

  try {
    const databaseViewService = DatabaseViewService.getInstance();

    const viewParamsArgs: {
      tableName: string;
      format: ViewFormat;
      limit: number;
      offset: number;
      columns?: string;
      where?: string;
      orderBy?: string;
      schemaOnly?: boolean;
    } = {
      tableName,
      format: viewFormat,
      limit,
      offset,
    };

    if (columns !== undefined) {
      viewParamsArgs.columns = columns;
    }
    if (where !== undefined) {
      viewParamsArgs.where = where;
    }
    if (orderBy !== undefined) {
      viewParamsArgs.orderBy = orderBy;
    }
    if (schemaOnly !== undefined) {
      viewParamsArgs.schemaOnly = schemaOnly;
    }

    const viewParams = buildViewParams(viewParamsArgs);

    const result = await databaseViewService.handleView(viewParams);

    processViewResult(result, viewFormat, logger, cliOutput);
  } catch (error) {
    const errorMessage
      = error instanceof Error ? error.message : 'Unknown error';
    logger.error(LogSource.CLI, 'Error viewing table', {
      error: errorMessage,
    });
    process.exit(1);
  }

  process.exit(0);
};

export const command = {
  description: 'View table contents and data',
  execute: executeViewCommand,
};
