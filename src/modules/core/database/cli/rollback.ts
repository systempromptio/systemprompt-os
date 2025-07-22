import type { CLICommand, CLIContext } from "@/cli/src/types";
import { ensureDatabaseInitialized } from "./utils";

export const command: CLICommand = {
  name: "rollback",
  description: "Rollback database migrations",
  options: [
    {
      name: "steps",
      alias: "s",
      type: "number",
      description: "Number of migrations to rollback",
      default: 1,
    },
    {
      name: "module",
      alias: "m",
      type: "string",
      description: "Rollback migrations for a specific module only",
    },
    {
      name: "force",
      alias: "f",
      type: "boolean",
      description: "Force rollback without confirmation",
      default: false,
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const steps = context.args.steps || 1;
      const moduleFilter = context.args.module;
      const force = context.args.force || false;
      
      const { dbService, migrationService } = await ensureDatabaseInitialized();

      // Check if database is initialized
      const isInitialized = await dbService.isInitialized();
      
      if (!isInitialized) {
        console.error("Database is not initialized. Nothing to rollback.");
        process.exit(1);
      }

      // Get executed migrations
      let executedMigrations = await migrationService.getExecutedMigrations();
      
      // Filter by module if specified
      if (moduleFilter) {
        executedMigrations = executedMigrations.filter(m => m.module === moduleFilter);
      }

      if (executedMigrations.length === 0) {
        console.log("No executed migrations found to rollback.");
        return;
      }

      // Limit to requested steps
      const migrationsToRollback = executedMigrations.slice(0, steps);

      console.log(`Planning to rollback ${migrationsToRollback.length} migration(s):\n`);
      
      for (const migration of migrationsToRollback) {
        console.log(`  - ${migration.module}/${migration.name} (executed: ${migration.executed_at})`);
      }

      if (!force) {
        console.log("\n⚠️  WARNING: This action cannot be undone!");
        console.log("Use --force flag to confirm rollback.\n");
        return;
      }

      console.log("\nExecuting rollbacks...\n");

      let successCount = 0;
      let failureCount = 0;

      for (const migration of migrationsToRollback) {
        try {
          console.log(`Rolling back ${migration.module}/${migration.name}...`);
          await migrationService.rollbackMigration(migration);
          console.log(`  ✓ Success`);
          successCount++;
        } catch (error: any) {
          console.error(`  ✗ Failed: ${error.message}`);
          failureCount++;
          
          // Stop on first failure to maintain consistency
          if (failureCount > 0) {
            break;
          }
        }
      }

      console.log(`\nRollback summary:`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Failed: ${failureCount}`);

      if (failureCount > 0) {
        console.error("\nSome rollbacks failed. Database may be in an inconsistent state.");
        process.exit(1);
      } else {
        console.log("\nAll rollbacks completed successfully.");
      }
    } catch (error: any) {
      console.error("Error rolling back migrations:", error.message);
      process.exit(1);
    }
  },
};