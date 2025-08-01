/**
 * Database migration CLI command.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { type Migration, ensureDatabaseInitialized } from '@/modules/core/database/cli/utils';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { z } from 'zod';

/**
 * CLI arguments schema for migrate command.
 */
const migrateArgsSchema = z.object({
  "format": z.enum(['text', 'json']).default('text'),
  'dry-run': z.boolean().default(false),
  "module": z.string().optional(),
});

type MigrateArgs = z.infer<typeof migrateArgsSchema>;

/**
 * Database migrate command implementation.
 */
export const command: ICLICommand = {
  name: 'migrate',
  description: 'Run pending database migrations',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
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
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs = migrateArgsSchema.parse(context.args);
      const {format} = validatedArgs;

      const { dbService, migrationService } = await ensureDatabaseInitialized();

      const isInitialized = await dbService.isInitialized();
      if (!isInitialized) {
        const message = "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.";
        cliOutput.error(message);
        logger.error(LogSource.DATABASE, message);
        process.exit(1);
      }

      const allMigrations = await migrationService.getPendingMigrations();

      const moduleFilter: string | undefined = validatedArgs.module;
      const migrations: Migration[] = moduleFilter
        ? allMigrations.filter((m: Migration): boolean => { return m.module === moduleFilter })
        : allMigrations;

      if (migrations.length === 0) {
        const message = 'No pending migrations found.';
        if (format === 'json') {
          cliOutput.json({
 migrations: [],
count: 0,
message
});
        } else {
          cliOutput.info(message);
        }
        return;
      }

      if (format === 'json') {
        cliOutput.json({
          migrations: migrations.map(m => { return {
            module: m.module,
            filename: m.filename,
            version: m.version
          } }),
          count: migrations.length
        });
      } else {
        cliOutput.info(`Found ${migrations.length} pending migration(s):\n`);
        for (const migration of migrations) {
          cliOutput.info(`  - ${migration.module}/${migration.filename} (${migration.version})`);
        }
      }

      const isDryRun: boolean = validatedArgs['dry-run'];
      if (isDryRun) {
        const message = '[DRY RUN] Migrations were not executed.';
        if (format === 'json') {
          cliOutput.json({
 dryRun: true,
message,
migrations: migrations.length
});
        } else {
          cliOutput.info(`\n${message}`);
        }
        return;
      }

      if (format === 'text') {
        cliOutput.info('\nExecuting migrations...\n');
      }

      let successfulMigrations: number = 0;
      let failedMigrations: number = 0;
      let hasFailed: boolean = false;

      for (const migration of migrations) {
        if (hasFailed) { break; }

        try {
          await migrationService.executeMigration(migration);
          const successMsg = `${migration.module}/${migration.filename} (${migration.version})`;
          if (format === 'text') {
            cliOutput.success(`  ✓ ${successMsg}`);
          }
          successfulMigrations++;
        } catch (error) {
          failedMigrations++;
          hasFailed = true;
          const errorMessage: string = error instanceof Error ? error.message : String(error);
          const failMsg = `Failed: ${errorMessage}`;
          if (format === 'text') {
            cliOutput.error(`  ✗ ${failMsg}`);
          }
          logger.error(LogSource.DATABASE, failMsg, { migration: migration.filename });
        }
      }

      const summary = {
        successful: successfulMigrations,
        failed: failedMigrations,
        total: migrations.length,
        hasErrors: hasFailed
      };

      if (format === 'json') {
        cliOutput.json(summary);
      } else {
        cliOutput.info('\nMigration summary:');
        cliOutput.info(`  Successful: ${successfulMigrations}`);
        cliOutput.info(`  Failed: ${failedMigrations}`);

        if (hasFailed) {
          cliOutput.error('\nSome migrations failed. Database may be in an inconsistent state.');
        } else {
          cliOutput.success('\nAll migrations completed successfully.');
        }
      }

      if (hasFailed) {
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }

      const errorMessage: string = error instanceof Error ? error.message : String(error);
      const outputFormat = 'text'
      if (outputFormat === 'json') {
        cliOutput.json({
 error: errorMessage,
success: false
});
      } else {
        cliOutput.error(`Error running migrations: ${errorMessage}`);
      }
      logger.error(LogSource.DATABASE, 'Error running migrations', { error });
      process.exit(1);
    }
  }
};
