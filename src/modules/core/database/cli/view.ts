/**
 * Database view CLI command.
 * This command provides functionality to view and inspect database table contents,
 * including schema information, data rows, and various output formats.
 * @file Database view CLI command.
 * @module modules/core/database/cli/view
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import {
  DatabaseViewService,
  type IColumnInfo,
  type IViewResult,
} from '@/modules/core/cli/services/database-view.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
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

  const firstRow = rows[0] as Record<string, unknown>;
  const columnNames = Object.keys(firstRow);
  logger.info(LogSource.CLI, columnNames.join(','));

  rows.forEach((row): void => {
    const values = columnNames.map((columnName): string => {
      const rowRecord = row as Record<string, unknown>;
      const { [columnName]: value } = rowRecord;
      if (
        typeof value === 'string' &&
        (value.includes(',') || value.includes('"'))
      ) {
        return `"${value.replace(/"/gu, '""')}"`;
      }
      return value !== null && value !== undefined ? String(value) : '';
    });
    logger.info(LogSource.CLI, values.join(','));
  });
};

/**
 * Display data in table format.
 * @param params - Table display parameters.
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
  const { tableName, rows, totalRows, offset, limit, hasMore } = params;

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

  const firstRow = rows[0] as Record<string, unknown>;
  const columnNames = Object.keys(firstRow);
  const columnWidths = columnNames.map((name): number => {
    const maxValueLength = Math.max(
      ...rows.map((row): number => {
        const rowRecord = row as Record<string, unknown>;
        const value = rowRecord[name];
        return value !== null && value !== undefined
          ? String(value).length
          : 0;
      }),
    );
    return Math.max(name.length, maxValueLength, 4);
  });

  const headerLine = columnNames
    .map((name, index): string => {
      return name.padEnd(columnWidths[index] ?? 0);
    })
    .join(' | ');
  logger.info(LogSource.CLI, headerLine);
  logger.info(LogSource.CLI, '-'.repeat(headerLine.length));

  rows.forEach((row): void => {
    const line = columnNames
      .map((name, index): string => {
        const rowRecord = row as Record<string, unknown>;
        const { [name]: value } = rowRecord;
        const stringValue =
          value !== null && value !== undefined ? String(value) : '';
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
 */
const processViewResult = (
  result: IViewResult,
  format: ViewFormat,
  logger: LoggerService,
): void => {
  if (!result.success) {
    logger.error(LogSource.CLI, result.message ?? 'Unknown error occurred');
    process.exit(1);
  }

  if (result.schema !== undefined) {
    if (format === 'json') {
      logger.info(LogSource.CLI, JSON.stringify(result.schema, null, 2));
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
    logger.info(LogSource.CLI, JSON.stringify(result.data, null, 2));
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
 * Main execute function for the view command.
 * @param context - CLI context containing arguments and configuration.
 */
const executeViewCommand = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const { args } = context;
  const {
    table: tableName,
    format,
    limit: limitParam,
    offset: offsetParam,
    columns,
    where,
    orderBy,
    schemaOnly,
  } = args as IViewArgs;

  const viewFormat = (format ?? 'table') as ViewFormat;
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
    const databaseViewService = DatabaseViewService.getInstance(logger);

    const result = await databaseViewService.handleView({
      tableName,
      format: viewFormat,
      limit,
      offset,
      columns,
      where,
      orderBy,
      schemaOnly,
    });

    processViewResult(result, viewFormat, logger);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
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