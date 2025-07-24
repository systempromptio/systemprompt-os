import type { CLICommand, CLIContext } from "@/modules/core/cli/types/index.js";
import { ensureDatabaseInitialized } from '@/modules/core/database/cli/utils.js';

export const command: CLICommand = {
  name: "schema",
  description: "Manage database schemas",
  options: [
    {
      name: "action",
      alias: "a",
      type: "string",
      description: "Action to perform (list, init, validate)",
    },
    {
      name: "module",
      alias: "m",
      type: "string",
      description: "Module name (for init action)",
    },
    {
      name: "force",
      alias: "f",
      type: "boolean",
      description: "Force initialization even if already initialized",
      default: false,
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const action = context.args['action'];
      const moduleFilter = context.args['module'];
      const force = context.args['force'] || false;

      const { dbService, schemaService } = await ensureDatabaseInitialized();

      switch (action) {
        case "list":
          await listSchemas(dbService, schemaService);
          break;

        case "init":
          await initializeSchema(dbService, schemaService, moduleFilter, force);
          break;

        case "validate":
          await validateSchemas(dbService, schemaService, moduleFilter);
          break;

        default:
          console.error(`Unknown action: ${action}`);
          console.error("Valid actions are: list, init, validate");
          process.exit(1);
      }
    } catch (error: any) {
      console.error("Error managing schema:", error.message);
      process.exit(1);
    }
  },
};

async function listSchemas(dbService: any, schemaService: any): Promise<void> {
  const isInitialized = await dbService.isInitialized();

  if (!isInitialized) {
    console.log("Database is not initialized. No schemas installed.");
    return;
  }

  const schemas = await schemaService.getInstalledSchemas();

  if (schemas.length === 0) {
    console.log("No schemas found.");
    return;
  }

  console.log("\nInstalled Schemas:\n");
  console.log("Module Name           Version    Installed At");
  console.log("-".repeat(60));

  for (const schema of schemas) {
    const moduleName = schema.module_name.padEnd(20);
    const version = (schema.version || "1.0.0").padEnd(10);
    const installedAt = new Date(schema.installed_at).toISOString()
.split('T')[0];
    console.log(`${moduleName} ${version} ${installedAt}`);
  }

  console.log("");
}

async function initializeSchema(
  dbService: any,
  schemaService: any,
  moduleFilter: string | undefined,
  force: boolean
): Promise<void> {
  const isInitialized = await dbService.isInitialized();

  if (isInitialized && !force) {
    console.error("Database is already initialized. Use --force to reinitialize.");
    process.exit(1);
  }

  if (force && isInitialized) {
    console.log("⚠️  WARNING: Force initializing will reset the database!");
    console.log("This action cannot be undone.\n");
  }

  console.log("Initializing database schema...\n");

  try {
    // Initialize base schema
    await schemaService.initializeBaseSchema();
    console.log("✓ Base schema initialized");

    // If module specified, initialize only that module's schema
    if (moduleFilter) {
      const moduleSchemas = await schemaService.discoverSchemasArray();
      const moduleSchema = moduleSchemas.find((s: any) => { return s.moduleName === moduleFilter });

      if (!moduleSchema) {
        console.error(`Module '${moduleFilter}' not found or has no schema.`);
        process.exit(1);
      }

      console.log(`\nInitializing schema for module: ${moduleFilter}`);
      await schemaService.installModuleSchema(moduleSchema);
      console.log(`✓ Schema for ${moduleFilter} initialized`);
    } else {
      // Initialize all discovered schemas
      const moduleSchemas = await schemaService.discoverSchemasArray();

      if (moduleSchemas.length > 0) {
        console.log(`\nFound ${moduleSchemas.length} module schema(s) to install:\n`);

        for (const schema of moduleSchemas) {
          console.log(`Installing schema for ${schema.moduleName}...`);
          try {
            await schemaService.installModuleSchema(schema);
            console.log(`  ✓ Success`);
          } catch (error: any) {
            console.error(`  ✗ Failed: ${error.message}`);
          }
        }
      }
    }

    console.log("\nDatabase initialization complete.");
  } catch (error: any) {
    console.error("Failed to initialize schema:", error.message);
    process.exit(1);
  }
}

async function validateSchemas(
  dbService: any,
  schemaService: any,
  moduleFilter: string | undefined
): Promise<void> {
  const isInitialized = await dbService.isInitialized();

  if (!isInitialized) {
    console.error("Database is not initialized. Nothing to validate.");
    process.exit(1);
  }

  console.log("Validating database schemas...\n");

  try {
    const installedSchemas = await schemaService.getInstalledSchemas();
    const discoveredSchemas = await schemaService.discoverSchemasArray();

    let hasErrors = false;

    // Check for missing schemas
    for (const discovered of discoveredSchemas) {
      if (moduleFilter && discovered.moduleName !== moduleFilter) {
        continue;
      }

      const installed = installedSchemas.find((s: any) => { return s.module_name === discovered.moduleName });

      if (!installed) {
        console.log(`⚠️  Schema for '${discovered.moduleName}' is not installed`);
        hasErrors = true;
      } else {
        console.log(`✓ Schema for '${discovered.moduleName}' is installed (v${installed.version})`);
      }
    }

    // Check for orphaned schemas
    for (const installed of installedSchemas) {
      if (moduleFilter && installed.module_name !== moduleFilter) {
        continue;
      }

      const discovered = discoveredSchemas.find((s: any) => { return s.moduleName === installed.module_name });

      if (!discovered) {
        console.log(`⚠️  Installed schema for '${installed.module_name}' has no corresponding module`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.log("\n⚠️  Schema validation found issues. Run 'systemprompt database:schema --action=init' to fix.");
      process.exit(1);
    } else {
      console.log("\n✓ All schemas are valid.");
    }
  } catch (error: any) {
    console.error("Failed to validate schemas:", error.message);
    process.exit(1);
  }
}
