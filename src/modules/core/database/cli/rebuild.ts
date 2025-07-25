/**
 * @file Database rebuild CLI command.
 * @module modules/core/database/cli/rebuild
 */

import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SchemaService } from '@/modules/core/database/services/schema.service.js';
import { SchemaImportService } from '@/modules/core/database/services/schema-import.service.js';
import type { ICLIContext } from '@/modules/core/cli/types/index.js';

export const command = {
  description: 'Rebuild database - drop all tables and recreate from schema files',
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

      // Get all tables (including system tables for complete rebuild)
      const allTables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      );

      console.log('🚨 DANGER: Database Rebuild Operation');
      console.log('=====================================');
      console.log('This will COMPLETELY DESTROY AND RECREATE the entire database:');
      console.log('');
      console.log('1. DROP all existing tables and data');
      console.log('2. Scan for schema files in all modules');
      console.log('3. Recreate database from schema files');
      console.log('');

      if (allTables.length > 0) {
        console.log(`Tables that will be DESTROYED (${allTables.length} total):`);
        allTables.forEach(table => {
          console.log(`  - ${table.name}`);
        });
        console.log('');
      }

      console.log('⚠️  ALL DATA WILL BE PERMANENTLY LOST');
      console.log('⚠️  THIS OPERATION CANNOT BE UNDONE');
      console.log('⚠️  MAKE SURE YOU HAVE BACKUPS');
      console.log('');

      if (!force && !confirm) {
        console.log('To proceed, use one of:');
        console.log('  --force   : Skip confirmation (extremely dangerous!)');
        console.log('  --confirm : Confirm you understand the risks');
        console.log('');
        console.log('Example: systemprompt database rebuild --confirm');
        process.exit(1);
      }

      if (!force) {
        console.log('You have confirmed that you want to rebuild the database.');
        console.log('Starting rebuild operation...');
        console.log('');
      }

      console.log('🗑️  Phase 1: Dropping all tables...');
      console.log('');

      // Drop all tables
      let droppedCount = 0;
      const failedDrops: string[] = [];

      await dbService.transaction(async (conn) => {
        // Disable foreign key constraints temporarily
        await conn.execute('PRAGMA foreign_keys = OFF');

        for (const table of allTables) {
          try {
            await conn.execute(`DROP TABLE IF EXISTS \`${table.name}\``);
            console.log(`✓ Dropped table: ${table.name}`);
            droppedCount++;
          } catch (error) {
            console.error(`✗ Failed to drop ${table.name}: ${error}`);
            failedDrops.push(table.name);
          }
        }

        // Re-enable foreign key constraints
        await conn.execute('PRAGMA foreign_keys = ON');
      });

      console.log('');
      console.log(`Tables dropped: ${droppedCount}/${allTables.length}`);

      if (failedDrops.length > 0) {
        console.error('Failed to drop some tables:');
        failedDrops.forEach(table => {
          console.error(`  - ${table}`);
        });
        console.error('');
        console.error('Rebuild cannot continue with remaining tables.');
        process.exit(1);
      }

      console.log('');
      console.log('🔍 Phase 2: Discovering schema files...');
      console.log('');

      // Get schema service and discover schemas
      const schemaService = SchemaService.getInstance();
      await schemaService.discoverSchemas();

      const schemas = schemaService.getAllSchemas();
      console.log(`Found ${schemas.size} modules with schemas:`);

      const schemaFiles: Array<{
        module: string;
        filepath: string;
        checksum: string;
        content: string;
      }> = [];

      for (const [moduleKey, schema] of schemas) {
        console.log(`  - ${moduleKey}`);

        // Calculate checksum for the schema
        const crypto = await import('crypto');
        const checksum = crypto.createHash('sha256').update(schema.sql)
.digest('hex');

        schemaFiles.push({
          module: moduleKey,
          filepath: schema.schemaPath,
          checksum,
          content: schema.sql,
        });

        // If there's an init file, add it too
        if (schema.initPath && schema.initSql) {
          const initChecksum = crypto.createHash('sha256').update(schema.initSql)
.digest('hex');
          schemaFiles.push({
            module: moduleKey,
            filepath: schema.initPath,
            checksum: initChecksum,
            content: schema.initSql,
          });
        }
      }

      if (schemaFiles.length === 0) {
        console.warn('Warning: No schema files found. Database will be empty.');
      }

      console.log('');
      console.log('🔨 Phase 3: Importing schemas...');
      console.log('');

      // Import schemas
      const importService = SchemaImportService.getInstance();
      await importService.initialize();

      const importResult = await importService.importSchemas(schemaFiles);

      console.log('Schema Import Results:');
      console.log(`  ✓ Imported: ${importResult.imported.length} files`);
      console.log(`  ⏭️  Skipped: ${importResult.skipped.length} files`);
      console.log(`  ✗ Errors: ${importResult.errors.length} files`);

      if (importResult.imported.length > 0) {
        console.log('');
        console.log('Successfully imported:');
        importResult.imported.forEach(file => {
          console.log(`  ✓ ${file}`);
        });
      }

      if (importResult.skipped.length > 0) {
        console.log('');
        console.log('Skipped (already up-to-date):');
        importResult.skipped.forEach(file => {
          console.log(`  ⏭️  ${file}`);
        });
      }

      if (importResult.errors.length > 0) {
        console.log('');
        console.error('Import errors:');
        importResult.errors.forEach(({ file, error }) => {
          console.error(`  ✗ ${file}: ${error}`);
        });
      }

      // Run VACUUM to optimize
      console.log('');
      console.log('🗜️  Phase 4: Optimizing database...');
      try {
        await dbService.execute('VACUUM');
        console.log('✓ Database optimized');
      } catch (error) {
        console.warn(`Warning: VACUUM failed: ${error}`);
      }

      // Final status
      console.log('');
      console.log('🎉 Database Rebuild Complete!');
      console.log('=============================');

      const finalTables = await dbService.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      );

      console.log(`Database now contains ${finalTables.length} tables:`);
      finalTables.forEach(table => {
        console.log(`  - ${table.name}`);
      });

      if (!importResult.success) {
        console.log('');
        console.warn('⚠️  Some schema imports failed. Database may be incomplete.');
        console.warn('Check the error messages above and fix any schema issues.');
        process.exit(1);
      }

      console.log('');
      console.log('Database rebuild completed successfully!');
    } catch (error) {
      console.error('Error rebuilding database:', error);
      console.error('');
      console.error('Database may be in an inconsistent state.');
      console.error('You may need to manually fix issues or restore from backup.');
      process.exit(1);
    }

    process.exit(0);
  },
};
