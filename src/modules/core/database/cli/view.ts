/**
 * @file Database view CLI command.
 * @module modules/core/database/cli/view
 */

import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ICLIContext } from '@/modules/core/cli/types/index.js';

export const command = {
  description: 'View table contents and data',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const tableName = args?.['table'] as string;
    const format = (args?.['format'] ?? 'table') as 'table' | 'json' | 'csv';
    const limit = typeof args?.['limit'] === 'number' ? args['limit'] : parseInt(String(args?.['limit'] ?? '50'), 10) || 50;
    const offset = typeof args?.['offset'] === 'number' ? args['offset'] : parseInt(String(args?.['offset'] ?? '0'), 10) || 0;
    const columns = args?.['columns'] as string | undefined;
    const where = args?.['where'] as string | undefined;
    const orderBy = args?.['order-by'] as string | undefined;
    const schemaOnly = args?.['schema-only'] === true;

    if (!tableName) {
      console.error('Error: Table name is required');
      console.log('Usage: systemprompt database:view --table <table_name>');
      process.exit(1);
    }

    try {
      const dbService = DatabaseService.getInstance();

      if (!await dbService.isConnected()) {
        console.log('Database is not connected');
        return;
      }

      // Validate table exists
      const tableExists = await dbService.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );

      if (tableExists[0]?.count === 0) {
        console.error(`Error: Table '${tableName}' does not exist`);
        process.exit(1);
      }

      // Get table schema
      const schema = await dbService.query<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>(`PRAGMA table_info(\`${tableName}\`)`);

      const columnInfo = schema.map(col => { return {
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primaryKey: col.pk > 0,
        defaultValue: col.dflt_value,
      } });

      if (schemaOnly) {
        if (format === 'json') {
          console.log(JSON.stringify({
 table: tableName,
columns: columnInfo
}, null, 2));
        } else {
          console.log(`Table: ${tableName}`);
          console.log('Schema:');
          console.log('-------');

          const maxNameLength = Math.max(10, ...columnInfo.map(c => { return c.name.length }));
          const maxTypeLength = Math.max(8, ...columnInfo.map(c => { return c.type.length }));

          const headerLine = `${'Column'.padEnd(maxNameLength)} | ${'Type'.padEnd(maxTypeLength)} | ${'Null'.padEnd(8)} | ${'Key'.padEnd(8)} | Default`;
          console.log(headerLine);
          console.log('-'.repeat(headerLine.length));

          columnInfo.forEach(col => {
            const nullable = col.nullable ? 'YES' : 'NO';
            const key = col.primaryKey ? 'PRIMARY' : '';
            const defaultVal = col.defaultValue ?? '';
            const line = `${col.name.padEnd(maxNameLength)} | ${col.type.padEnd(maxTypeLength)} | ${nullable.padEnd(8)} | ${key.padEnd(8)} | ${defaultVal}`;
            console.log(line);
          });
        }
        return;
      }

      // Build query for data
      let selectColumns = '*';
      if (columns) {
        const requestedColumns = columns.split(',').map(c => { return c.trim() });
        const validColumns = columnInfo.map(c => { return c.name });
        const invalidColumns = requestedColumns.filter(c => { return !validColumns.includes(c) });

        if (invalidColumns.length > 0) {
          console.error(`Error: Invalid columns: ${invalidColumns.join(', ')}`);
          process.exit(1);
        }

        selectColumns = requestedColumns.map(c => { return `\`${c}\`` }).join(', ');
      }

      let query = `SELECT ${selectColumns} FROM \`${tableName}\``;
      const params: unknown[] = [];

      if (where) {
        query += ` WHERE ${where}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await dbService.query(query, params);

      // Get total count for pagination info
      let countQuery = `SELECT COUNT(*) as count FROM \`${tableName}\``;
      if (where) {
        countQuery += ` WHERE ${where}`;
      }
      const totalResult = await dbService.query<{ count: number }>(countQuery);
      const totalRows = totalResult[0]?.count ?? 0;

      const result = {
        table: tableName,
        totalRows,
        displayedRows: rows.length,
        offset,
        limit,
        hasMore: offset + rows.length < totalRows,
        columns: columnInfo,
        data: rows,
      };

      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (format === 'csv') {
        if (rows.length > 0) {
          const columnNames = Object.keys(rows[0] as Record<string, unknown>);
          console.log(columnNames.join(','));

          rows.forEach(row => {
            const values = columnNames.map(col => {
              const value = (row as any)[col];
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? '';
            });
            console.log(values.join(','));
          });
        }
      } else {
        console.log(`Table: ${tableName}`);
        console.log(`Showing ${rows.length} of ${totalRows.toLocaleString()} rows${offset > 0 ? ` (offset: ${offset})` : ''}`);

        if (rows.length > 0) {
          console.log('');

          const columnNames = Object.keys(rows[0] as Record<string, unknown>);
          const columnWidths = columnNames.map(name => {
            const maxValueLength = Math.max(
              ...rows.map(row => { return String((row as any)[name] ?? '').length })
            );
            return Math.max(name.length, maxValueLength, 4);
          });

          const headerLine = columnNames.map((name, i) => { return name.padEnd(columnWidths[i] || 0) }).join(' | ');
          console.log(headerLine);
          console.log('-'.repeat(headerLine.length));

          rows.forEach(row => {
            const line = columnNames.map((name, i) => {
              const value = (row as any)[name];
              return String(value ?? '').padEnd(columnWidths[i] || 0);
            }).join(' | ');
            console.log(line);
          });

          if (result.hasMore) {
            console.log('');
            console.log(`... ${totalRows - offset - rows.length} more rows available`);
            console.log(`Use --offset ${offset + limit} to see more`);
          }
        } else {
          console.log('\nNo data found.');
        }
      }
    } catch (error) {
      console.error('Error viewing table:', error);
      process.exit(1);
    }

    process.exit(0);
  },
};
