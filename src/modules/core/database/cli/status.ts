/**
 * @file Database status CLI command.
 * @module modules/core/database/cli/status
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ICLIContext } from '@/modules/core/cli/types/index';

export const command = {
  description: 'Show database connection health and status',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const format = (args?.format ?? 'text') as 'text' | 'json';
    const detailed = args?.detailed === true;

    try {
      const dbService = DatabaseService.getInstance();

      const status = {
        connected: await dbService.isConnected(),
        initialized: await dbService.isInitialized(),
        type: dbService.getDatabaseType(),
        timestamp: new Date().toISOString(),
      };

      let detailedInfo = {};
      if (detailed && status.connected) {
        try {
          const tables = await dbService.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          );
          const schemaVersions = await dbService.query<{ module: string; version: string }>(
            "SELECT module, version FROM _schema_versions ORDER BY module"
          );

          detailedInfo = {
            tableCount: tables.length,
            tables: tables.map(t => { return t.name }),
            schemaVersions,
          };
        } catch (error) {
          detailedInfo = { error: 'Failed to retrieve detailed information' };
        }
      }

      const result = detailed ? {
 ...status,
...detailedInfo
} : status;

      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Database Status:');
        console.log(`  Connected: ${status.connected ? '✓' : '✗'}`);
        console.log(`  Initialized: ${status.initialized ? '✓' : '✗'}`);
        console.log(`  Type: ${status.type}`);
        console.log(`  Timestamp: ${status.timestamp}`);

        if (detailed && status.connected) {
          console.log('\nDetailed Information:');
          if ('tableCount' in detailedInfo) {
            console.log(`  Tables: ${(detailedInfo as any).tableCount}`);
            if ((detailedInfo as any).tables?.length > 0) {
              console.log('  Table Names:');
              (detailedInfo as any).tables.forEach((table: string) => {
                console.log(`    - ${table}`);
              });
            }
            if ((detailedInfo as any).schemaVersions?.length > 0) {
              console.log('  Schema Versions:');
              (detailedInfo as any).schemaVersions.forEach((schema: any) => {
                console.log(`    ${schema.module}: ${schema.version}`);
              });
            }
          } else if ('error' in detailedInfo) {
            console.log(`  Error: ${(detailedInfo as any).error}`);
          }
        }
      }
    } catch (error) {
      console.error('Error getting database status:', error);
      process.exit(1);
    }

    process.exit(0);
  },
};
