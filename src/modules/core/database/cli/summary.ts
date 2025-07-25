/**
 * @file Database summary CLI command.
 * @module modules/core/database/cli/summary
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ICLIContext } from '@/modules/core/cli/types/index';

interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: Array<{ name: string; type: string; nullable: boolean; primaryKey: boolean }>;
}

export const command = {
  description: 'Show formatted summary of database tables and statistics',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const format = (args?.format ?? 'table') as 'text' | 'json' | 'table';
    const includeSystem = args?.['include-system'] === true;
    const sortBy = (args?.['sort-by'] ?? 'name') as 'name' | 'rows' | 'columns';

    try {
      const dbService = DatabaseService.getInstance();

      if (!await dbService.isConnected()) {
        console.log('Database is not connected');
        return;
      }

      let tableQuery = "SELECT name FROM sqlite_master WHERE type='table'";
      if (!includeSystem) {
        tableQuery += " AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'";
      }
      tableQuery += " ORDER BY name";

      const tables = await dbService.query<{ name: string }>(tableQuery);

      const tableInfos: TableInfo[] = [];

      for (const table of tables) {
        try {
          const rowCountResult = await dbService.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM \`${table.name}\``
          );
          const rowCount = rowCountResult[0]?.count ?? 0;

          const columns = await dbService.query<{
            name: string;
            type: string;
            notnull: number;
            pk: number;
          }>(`PRAGMA table_info(\`${table.name}\`)`);

          const columnInfo = columns.map(col => { return {
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            primaryKey: col.pk > 0,
          } });

          tableInfos.push({
            name: table.name,
            rowCount,
            columnCount: columns.length,
            columns: columnInfo,
          });
        } catch (error) {
          console.warn(`Warning: Could not access table ${table.name}`);
        }
      }

      tableInfos.sort((a, b) => {
        switch (sortBy) {
          case 'rows':
            return b.rowCount - a.rowCount;
          case 'columns':
            return b.columnCount - a.columnCount;
          case 'name':
          default:
            return a.name.localeCompare(b.name);
        }
      });

      const summary = {
        totalTables: tableInfos.length,
        totalRows: tableInfos.reduce((sum, table) => { return sum + table.rowCount }, 0),
        averageRowsPerTable: tableInfos.length > 0
          ? Math.round(tableInfos.reduce((sum, table) => { return sum + table.rowCount }, 0) / tableInfos.length)
          : 0,
        tables: tableInfos,
        timestamp: new Date().toISOString(),
      };

      if (format === 'json') {
        console.log(JSON.stringify(summary, null, 2));
      } else if (format === 'table') {
        console.log('Database Summary');
        console.log('================');
        console.log(`Total Tables: ${summary.totalTables}`);
        console.log(`Total Rows: ${summary.totalRows.toLocaleString()}`);
        console.log(`Average Rows/Table: ${summary.averageRowsPerTable.toLocaleString()}`);
        console.log('');

        if (tableInfos.length > 0) {
          const maxNameLength = Math.max(10, ...tableInfos.map(t => { return t.name.length }));
          const headerLine = `${'Table Name'.padEnd(maxNameLength)} | ${'Rows'.padStart(10)} | ${'Columns'.padStart(8)}`;
          const separatorLine = '-'.repeat(headerLine.length);

          console.log(headerLine);
          console.log(separatorLine);

          tableInfos.forEach(table => {
            const line = `${table.name.padEnd(maxNameLength)} | ${table.rowCount.toLocaleString().padStart(10)} | ${table.columnCount.toString().padStart(8)}`;
            console.log(line);
          });
        }
      } else {
        console.log('Database Summary:');
        console.log(`  Total Tables: ${summary.totalTables}`);
        console.log(`  Total Rows: ${summary.totalRows.toLocaleString()}`);
        console.log(`  Average Rows per Table: ${summary.averageRowsPerTable.toLocaleString()}`);
        console.log('');

        if (tableInfos.length > 0) {
          console.log('Tables:');
          tableInfos.forEach(table => {
            console.log(`  ${table.name}:`);
            console.log(`    Rows: ${table.rowCount.toLocaleString()}`);
            console.log(`    Columns: ${table.columnCount}`);
          });
        }
      }
    } catch (error) {
      console.error('Error getting database summary:', error);
      process.exit(1);
    }

    process.exit(0);
  },
};
