import type { CLICommand, CLIContext } from "../../../../cli/src/types.js";
import { ensureDatabaseInitialized } from "./utils.js";

export const command: CLICommand = {
  name: "status",
  description: "Show database connection status and information",
  options: [
    {
      name: "format",
      alias: "f",
      type: "string",
      description: "Output format (json, table)",
      default: "table",
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const format = context.args.format || "table";
      const { dbService, migrationService, schemaService } = await ensureDatabaseInitialized();

      // Check if database is initialized
      const isInitialized = await dbService.isInitialized();
      
      if (!isInitialized) {
        console.error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
      }

      // Get connection info
      const connection = await dbService.getConnection();
      const databaseType = process.env.DATABASE_TYPE || "sqlite";
      const databaseFile = process.env.DATABASE_FILE || "./state/database.db";
      
      // Get migration status
      const pendingMigrations = await migrationService.getPendingMigrations();
      const executedMigrations = await migrationService.getExecutedMigrations();
      
      // Get schema info
      const schemas = await schemaService.getInstalledSchemas();

      const status = {
        connection: {
          type: databaseType,
          file: databaseType === "sqlite" ? databaseFile : undefined,
          host: databaseType === "postgres" ? process.env.POSTGRES_HOST : undefined,
          database: databaseType === "postgres" ? process.env.POSTGRES_DB : undefined,
          status: connection ? "connected" : "disconnected",
        },
        migrations: {
          executed: executedMigrations.length,
          pending: pendingMigrations.length,
          lastExecuted: executedMigrations[0]?.executed_at || "none",
        },
        schemas: {
          installed: schemas.length,
          modules: schemas.map(s => s.module_name),
        },
      };

      if (format === "json") {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log("\n=== Database Status ===\n");
        
        console.log("Connection:");
        console.log(`  Type: ${status.connection.type}`);
        if (status.connection.file) {
          console.log(`  File: ${status.connection.file}`);
        }
        if (status.connection.host) {
          console.log(`  Host: ${status.connection.host}`);
          console.log(`  Database: ${status.connection.database}`);
        }
        console.log(`  Status: ${status.connection.status}`);
        
        console.log("\nMigrations:");
        console.log(`  Executed: ${status.migrations.executed}`);
        console.log(`  Pending: ${status.migrations.pending}`);
        console.log(`  Last Executed: ${status.migrations.lastExecuted}`);
        
        console.log("\nSchemas:");
        console.log(`  Installed: ${status.schemas.installed}`);
        if (status.schemas.modules.length > 0) {
          console.log(`  Modules: ${status.schemas.modules.join(", ")}`);
        }
        
        console.log("");
      }
    } catch (error: any) {
      console.error("Error getting database status:", error.message);
      process.exit(1);
    }
  },
};