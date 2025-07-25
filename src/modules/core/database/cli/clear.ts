/**
 * @file Database clear CLI command.
 * @module modules/core/database/cli/clear
 */

import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ICLIContext } from '@/modules/core/cli/types/index.js';

export const command = {
  description: 'Clear all data from database tables (preserves schema)',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const force = args?.['force'] === true;
    const confirm = args?.['confirm'] === true;

    try {
      const dbService = DatabaseService.getInstance();

      if (!await dbService.isConnected()) {
        console.error('Database is not connected');
        process.exit(1);
      }

      // Get all user tables (exclude sqlite system tables and underscore prefixed tables)
      const tables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' 
         AND name NOT LIKE '_%'
         ORDER BY name`,
      );

      if (tables.length === 0) {
        console.log('No user tables found to clear');
        process.exit(0);
      }

      console.log('⚠️  WARNING: Database Clear Operation');
      console.log('=====================================');
      console.log('This will DELETE ALL DATA from the following tables:');
      console.log('');
      tables.forEach((table) => {
        console.log(`  - ${table.name}`);
      });
      console.log('');
      console.log('The table schemas will be preserved, but ALL DATA WILL BE LOST.');
      console.log('This operation CANNOT be undone.');
      console.log('');

      if (!force && !confirm) {
        console.log('To proceed, use one of:');
        console.log('  --force   : Skip confirmation (dangerous!)');
        console.log('  --confirm : Confirm you understand the risks');
        console.log('');
        console.log('Example: systemprompt database clear --confirm');
        process.exit(1);
      }

      if (!force) {
        console.log('You have confirmed that you want to clear all data.');
        console.log('Starting clear operation...');
        console.log('');
      }

      // Clear tables in a transaction
      let clearedCount = 0;
      const failedTables: string[] = [];

      await dbService.transaction(async (conn) => {
        for (const table of tables) {
          try {
            // Get row count before clearing
            const beforeCount = await conn.query<{ count: number }>(
              `SELECT COUNT(*) as count FROM \`${table.name}\``,
            );
            const rowsBefore = beforeCount.rows.length > 0 && beforeCount.rows[0] ? beforeCount.rows[0].count : 0;

            // Clear the table
            await conn.execute(`DELETE FROM \`${table.name}\``);

            console.log(`✓ Cleared ${table.name} (${rowsBefore.toLocaleString()} rows deleted)`);
            clearedCount++;
          } catch (error) {
            console.error(`✗ Failed to clear ${table.name}: ${error}`);
            failedTables.push(table.name);
          }
        }
      });

      console.log('');
      console.log('Clear Operation Complete');
      console.log('========================');
      console.log(`Successfully cleared: ${clearedCount} tables`);

      if (failedTables.length > 0) {
        console.log(`Failed to clear: ${failedTables.length} tables`);
        console.log('Failed tables:');
        failedTables.forEach((table) => {
          console.log(`  - ${table}`);
        });
      }

      // Run VACUUM to reclaim space
      try {
        console.log('');
        console.log('Running VACUUM to reclaim disk space...');
        await dbService.execute('VACUUM');
        console.log('✓ Database optimized');
      } catch (error) {
        console.warn(`Warning: VACUUM failed: ${error}`);
      }

      console.log('');
      console.log('Database clear completed successfully!');
    } catch (error) {
      console.error('Error clearing database:', error);
      process.exit(1);
    }

    process.exit(0);
  },
};
