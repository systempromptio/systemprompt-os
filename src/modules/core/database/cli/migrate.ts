import type { CLICommand, CLIContext } from "../../../../cli/src/types.js";
import { ensureDatabaseInitialized } from "./utils.js";

export const command: CLICommand = {
  name: "migrate",
  description: "Run pending database migrations",
  options: [
    {
      name: "dry-run",
      alias: "d",
      type: "boolean",
      description: "Preview migrations without running them",
      default: false,
    },
    {
      name: "module",
      alias: "m",
      type: "string",
      description: "Run migrations for a specific module only",
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const dryRun = context.args["dry-run"] || false;
      const moduleFilter = context.args.module;
      
      const { dbService, migrationService } = await ensureDatabaseInitialized();

      // Check if database is initialized
      const isInitialized = await dbService.isInitialized();
      
      if (!isInitialized) {
        console.error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
      }

      // Get pending migrations
      let pendingMigrations = await migrationService.getPendingMigrations();
      
      // Filter by module if specified
      if (moduleFilter) {
        pendingMigrations = pendingMigrations.filter(m => m.module === moduleFilter);
      }

      if (pendingMigrations.length === 0) {
        console.log("No pending migrations found.");
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);
      
      for (const migration of pendingMigrations) {
        console.log(`  - ${migration.module}/${migration.filename} (${migration.version})`);
      }

      if (dryRun) {
        console.log("\n[DRY RUN] Migrations were not executed.");
        return;
      }

      console.log("\nExecuting migrations...\n");

      let successCount = 0;
      let failureCount = 0;

      for (const migration of pendingMigrations) {
        try {
          console.log(`Running ${migration.module}/${migration.filename}...`);
          await migrationService.executeMigration(migration);
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

      console.log(`\nMigration summary:`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Failed: ${failureCount}`);

      if (failureCount > 0) {
        console.error("\nSome migrations failed. Database may be in an inconsistent state.");
        process.exit(1);
      } else {
        console.log("\nAll migrations completed successfully.");
      }
    } catch (error: any) {
      console.error("Error running migrations:", error.message);
      process.exit(1);
    }
  },
};