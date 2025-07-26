/**
 * Database migration CLI command.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { type Migration, ensureDatabaseInitialized } from '@/modules/core/database/cli/utils';

export interface MigrateOptions {
  'dry-run'?: boolean;
  module?: string;
}

export interface MigrateContext extends ICLIContext {
  args: Record<string, unknown> & {
    'dry-run'?: boolean;
    module?: string;
  };
}

/**
 * Database migrate command implementation.
 */
export const command: ICLICommand = {
  name: 'migrate',
  description: 'Run pending database migrations',
  options: [
    {
      name: 'dry-run',
      alias: 'd',
      type: 'boolean',
      default: false,
      description: 'Show what migrations would be run without executing them'
    },
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Run migrations for a specific module only'
    }
  ],

  async execute(context: ICLIContext): Promise<void> {
    try {
      const { dbService, migrationService } = await ensureDatabaseInitialized();

      const isInitialized = await dbService.isInitialized();
      if (!isInitialized) {
        console.error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
      }

      const allMigrations = await migrationService.getPendingMigrations();

      const moduleFilter: string | undefined = context.args.module as string | undefined;
      const migrations: Migration[] = moduleFilter
        ? allMigrations.filter((m: Migration): boolean => { return m.module === moduleFilter })
        : allMigrations;

      if (migrations.length === 0) {
        console.log('No pending migrations found.');
        return;
      }

      console.log(`Found ${migrations.length} pending migration(s):\n`);
      for (const migration of migrations) {
        console.log(`  - ${migration.module}/${migration.filename} (${migration.version})`);
      }

      const isDryRun: boolean = Boolean(context.args['dry-run']);
      if (isDryRun) {
        console.log('\n[DRY RUN] Migrations were not executed.');
        return;
      }

      console.log('\nExecuting migrations...\n');

      let successfulMigrations: number = 0;
      let failedMigrations: number = 0;
      let hasFailed: boolean = false;

      for (const migration of migrations) {
        if (hasFailed) { break; }

        try {
          await migrationService.executeMigration(migration);
          console.log(`  ✓ ${migration.module}/${migration.filename} (${migration.version})`);
          successfulMigrations++;
        } catch (error) {
          failedMigrations++;
          hasFailed = true;
          const errorMessage: string = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ Failed: ${errorMessage}`);
        }
      }

      console.log('\nMigration summary:');
      console.log(`  Successful: ${successfulMigrations}`);
      console.log(`  Failed: ${failedMigrations}`);

      if (hasFailed) {
        console.error('\nSome migrations failed. Database may be in an inconsistent state.');
        process.exit(1);
      } else {
        console.log('\nAll migrations completed successfully.');
      }
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : String(error);
      console.error('Error running migrations:', errorMessage);
      process.exit(1);
    }
  }
};
