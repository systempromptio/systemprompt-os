/**
 * Database query CLI command.
 * This module provides functionality to execute SQL queries safely with admin-only access.
 * @file Database query CLI command.
 * @module modules/core/database/cli/query
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import * as readline from 'readline';
import { readFile } from 'fs/promises';

/**
 * Type guard to check if a value is a record with string keys.
 * @param value
 */
function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(item =>
    { return typeof item === 'object' && item !== null && !Array.isArray(item) });
}

/**
 * Format output types supported by the query command.
 */
type OutputFormat = 'table' | 'json' | 'csv';

/**
 * Check if a query is read-only (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH).
 * @param sql - SQL query string to validate.
 * @returns True if query is read-only, false otherwise.
 */
const isReadOnlyQuery = (sql: string): boolean => {
  const trimmedSql = sql.trim().toLowerCase();
  const writePatterns = [
    /^insert\s/,
    /^update\s/,
    /^delete\s/,
    /^drop\s/,
    /^create\s/,
    /^alter\s/,
    /^truncate\s/
  ];

  if (writePatterns.some(pattern => { return pattern.test(trimmedSql) })) {
    return false;
  }

  return true;
};

/**
 * Format table output with proper column alignment.
 * @param results - Query results array.
 * @returns Formatted table string.
 */
const formatTableOutput = (results: Record<string, unknown>[]): string[] => {
  if (results.length === 0) {
    return ['(0 rows)'];
  }

  const output: string[] = [];
  const firstRow = results[0];
  if (firstRow === undefined) {
    return ['(0 rows)'];
  }
  const keys = Object.keys(firstRow);

  const columnWidths = keys.map(key => {
    const headerWidth = key.length;
    const maxDataWidth = Math.max(
      ...results.map(row => {
        const value = row[key];
        const displayValue = value === null ? 'NULL' : String(value);
        return displayValue.length;
      })
    );
    return Math.max(headerWidth, maxDataWidth);
  });

  const header = keys.map((key, i) => {
    const width = columnWidths[i];
    return key.padEnd(width ?? 0);
  }).join(' | ');
  output.push(header);

  const separator = '-'.repeat(header.length - 1);
  output.push(separator);

  results.forEach(row => {
    const rowStr = keys.map((key, i) => {
      const value = row[key];
      const displayValue = value === null ? 'NULL' : String(value);
      const width = columnWidths[i];
      return displayValue.padEnd(width ?? 0);
    }).join(' | ');
    output.push(rowStr);
  });

  return output;
};

/**
 * Format CSV output with proper escaping.
 * @param results - Query results array.
 * @returns Formatted CSV lines.
 */
const formatCsvOutput = (results: Record<string, unknown>[]): string[] => {
  if (results.length === 0) {
    return ['(0 rows)'];
  }

  const output: string[] = [];
  const firstRow = results[0];
  if (firstRow === undefined) {
    return ['(0 rows)'];
  }
  const keys = Object.keys(firstRow);

  output.push(keys.join(','));

  results.forEach(row => {
    const rowValues = keys.map(key => {
      const value = row[key];
      if (value === null) {
        return '';
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    output.push(rowValues.join(','));
  });

  return output;
};

/**
 * Parse SQL file content into individual queries.
 * @param content - File content string.
 * @returns Array of individual SQL queries.
 */
const parseQueries = (content: string): string[] => {
  return content
    .split(';')
    .map(query => { return query.trim() })
    .filter(query => { return query.length > 0 });
};

/**
 * Execute a single query and format the output.
 * @param sql - SQL query string.
 * @param format - Output format.
 * @param dbService - Database service instance.
 * @returns Formatted output lines and execution time.
 */
const executeQuery = async (
  sql: string,
  format: OutputFormat,
  dbService: DatabaseService
): Promise<{ output: string[]; executionTime: number }> => {
  const startTime = Date.now();
  const results = await dbService.query(sql);
  const executionTime = Date.now() - startTime;

  let output: string[];

  if (!Array.isArray(results)) {
    output = [`Query executed successfully (${executionTime}ms)`];
    return {
      output,
      executionTime
    };
  }

  if (!isRecordArray(results)) {
    output = [`Query executed successfully (${executionTime}ms)`];
    return {
      output,
      executionTime
    };
  }

  switch (format) {
    case 'json':
      output = [JSON.stringify(results, null, 2)];
      break;
    case 'csv':
      output = formatCsvOutput(results);
      break;
    case 'table':
    default:
      output = formatTableOutput(results);
      break;
  }

  return {
    output,
    executionTime
  };
};

/**
 * Handle interactive query mode.
 * @param dbService - Database service instance.
 * @param format - Output format.
 * @param readonly - Whether to restrict to read-only queries.
 */
const handleInteractiveMode = async (
  dbService: DatabaseService,
  format: OutputFormat,
  readonly: boolean
): Promise<void> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'query> '
  });

  console.log('Interactive SQL query mode. Type ".exit" to quit.');
  rl.prompt();

  rl.on('line', async (input: string) => {
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
      if (readonly && !isReadOnlyQuery(trimmedInput)) {
        console.error('Error: Only SELECT queries are allowed in readonly mode.');
        console.error('Use --readonly=false to execute write queries.');
        rl.prompt();
        return;
      }

      const { output, executionTime } = await executeQuery(trimmedInput, format, dbService);

      output.forEach(line => { console.log(line); });

      const firstLine = output[0];
      if (format === 'table' && output.length > 1 && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
        const rowCount = output.length - 2
        console.log(`(${rowCount} rows in ${executionTime}ms)`);
      } else if (format !== 'table' && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
        console.log(`Query executed successfully (${executionTime}ms)`);
      }
    } catch (error) {
      console.error('Query failed:', (error as Error).message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nExiting interactive mode.');
    process.exit(0);
  });
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
    const dbService = DatabaseService.getInstance();

    try {
      const isInitialized = await dbService.isInitialized();
      if (!isInitialized) {
        console.error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
        return;
      }

      const format = (args.format as OutputFormat) || 'table';
      const readonly = args.readonly !== false;
      const interactive = args.interactive === true;
      const sql = args.sql as string;
      const file = args.file as string;

      if (!sql && !file && !interactive) {
        console.error('Please provide --sql, --file, or --interactive option.');
        process.exit(1);
        return;
      }

      if (interactive) {
        await handleInteractiveMode(dbService, format, readonly);
        return;
      }

      if (file) {
        try {
          const content = await readFile(file, 'utf-8');
          const queries = parseQueries(content);

          if (queries.length === 0) {
            console.log('No queries found in file.');
            return;
          }

          console.log(`Executing ${queries.length} queries from ${file}...\n`);

          for (const query of queries) {
            if (readonly && !isReadOnlyQuery(query)) {
              console.error('Error: Only SELECT queries are allowed in readonly mode.');
              console.error('Use --readonly=false to execute write queries.');
              process.exit(1);
              return;
            }

            const { output, executionTime } = await executeQuery(query, format, dbService);

            output.forEach(line => { console.log(line); });

            const firstLine = output[0];
            if (format === 'table' && output.length > 1 && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
              const rowCount = output.length - 2
              console.log(`(${rowCount} rows in ${executionTime}ms)`);
            } else if (format !== 'table' && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
              console.log(`Query executed successfully (${executionTime}ms)`);
            }

            console.log()
          }
        } catch (error) {
          console.error('Query failed:', (error as Error).message);
          process.exit(1);
          return;
        }
        return;
      }

      if (sql) {
        if (readonly && !isReadOnlyQuery(sql)) {
          console.error('Error: Only SELECT queries are allowed in readonly mode.');
          console.error('Use --readonly=false to execute write queries.');
          process.exit(1);
          return;
        }

        try {
          const { output, executionTime } = await executeQuery(sql, format, dbService);

          output.forEach(line => { console.log(line); });

          const firstLine = output[0];
          if (format === 'table' && output.length > 1 && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
            const rowCount = output.length - 2
            console.log(`(${rowCount} rows in ${executionTime}ms)`);
          } else if (format !== 'table' && firstLine !== undefined && firstLine !== '(0 rows)' && !firstLine.includes('Query executed successfully')) {
            console.log(`Query executed successfully (${executionTime}ms)`);
          }
        } catch (error) {
          console.error('Query failed:', (error as Error).message);
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Query failed:', (error as Error).message);
      process.exit(1);
    }
  }
};
