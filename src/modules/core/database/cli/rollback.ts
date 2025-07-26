/**
 * Database rollback CLI command.
 * Rolls back database migrations in reverse order of execution.
 * @file Database rollback CLI command.
 * @module modules/core/database/cli/rollback
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import type { IExecutedMigration } from '@/modules/core/database/types/migration.types';

/**
 * Interface for rollback execution results.
 */
interface IRollbackResult {
  successful: number;
  failed: number;
  hasFailures: boolean;
}

/**
 * Display rollback plan to user.
 * @param migrations - Migrations to be rolled back.
 */
const displayRollbackPlan = (migrations: IExecutedMigration[]): void => {
  console.log(`Planning to rollback ${migrations.length} migration(s):\n`);

  migrations.forEach((migration) => {
    console.log(`  - ${migration.module}/${migration.name} (executed: ${migration.executedAt})`);
  });
};

/**
 * Display warning message about rollback consequences.
 */
const displayWarning = (): void => {
  console.log('\n⚠️  WARNING: This action cannot be undone!');
  console.log('Use --force flag to confirm rollback.\n');
};

/**
 * Execute rollbacks for the provided migrations.
 * @param migrations - Migrations to rollback.
 * @param migrationService - Migration service instance.
 * @returns Rollback execution results.
 */
const executeRollbacks = async (
  migrations: IExecutedMigration[],
  migrationService: MigrationService
): Promise<IRollbackResult> => {
  console.log('\nExecuting rollbacks...\n');

  let successful = 0;
  let failed = 0;

  for (const migration of migrations) {
    try {
      console.log(`Rolling back ${migration.module}/${migration.name}...`);
      await migrationService.rollbackMigration(migration);
      console.log('  ✓ Success');
      successful++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ✗ Failed: ${errorMessage}`);
      failed++;
      break
    }
  }

  return {
    successful,
    failed,
    hasFailures: failed > 0
  };
};

/**
 * Display rollback summary.
 * @param result - Rollback execution results.
 */
const displaySummary = (result: IRollbackResult): void => {
  console.log('\nRollback summary:');
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);

  if (result.hasFailures) {
    console.error('\nSome rollbacks failed. Database may be in an inconsistent state.');
  } else {
    console.log('\nAll rollbacks completed successfully.');
  }
};

/**
 * Filter migrations by module if specified.
 * @param migrations - All executed migrations.
 * @param moduleFilter - Optional module filter.
 * @returns Filtered migrations.
 */
const filterMigrationsByModule = (
  migrations: IExecutedMigration[],
  moduleFilter?: string
): IExecutedMigration[] => {
  if (!moduleFilter) {
    return migrations;
  }

  return migrations.filter((migration) => { return migration.module === moduleFilter });
};

/**
 * Limit migrations by steps parameter.
 * @param migrations - Filtered migrations.
 * @param steps - Maximum number of migrations to rollback.
 * @returns Limited migrations array.
 */
const limitMigrationsBySteps = (
  migrations: IExecutedMigration[],
  steps: number
): IExecutedMigration[] => {
  return migrations.slice(0, steps);
};

export const command = {
  name: 'rollback',
  description: 'Rollback database migrations',
  options: [
    {
      name: 'steps',
      type: 'number' as const,
      description: 'Number of migrations to rollback',
      default: 1,
    },
    {
      name: 'force',
      type: 'boolean' as const,
      description: 'Skip confirmation prompt',
      default: false,
    },
    {
      name: 'module',
      type: 'string' as const,
      description: 'Filter rollbacks by module name',
    },
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    try {
      const { args } = context;

      const databaseService = DatabaseService.getInstance();
      const migrationService = MigrationService.getInstance();

      const isInitialized = await databaseService.isInitialized();
      if (!isInitialized) {
        console.error('Database is not initialized. Nothing to rollback.');
        process.exit(1);
        return;
      }

      const allExecutedMigrations = await migrationService.getExecutedMigrations();

      const moduleFilter = args.module as string | undefined;
      const filteredMigrations = filterMigrationsByModule(allExecutedMigrations, moduleFilter);

      if (filteredMigrations.length === 0) {
        console.log('No executed migrations found to rollback.');
        return;
      }

      const steps = (args.steps as number) || 1;
      const migrationsToRollback = limitMigrationsBySteps(filteredMigrations, steps);

      displayRollbackPlan(migrationsToRollback);

      const force = args.force as boolean;
      if (!force) {
        displayWarning();
        return;
      }

      const result = await executeRollbacks(migrationsToRollback, migrationService);

      displaySummary(result);

      if (result.hasFailures) {
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error rolling back migrations:', errorMessage);
      process.exit(1);
    }
  },
};
