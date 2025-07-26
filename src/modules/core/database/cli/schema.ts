/**
 * Database schema CLI command.
 * This module provides functionality to manage database schemas including
 * listing, initializing, and validating schemas across modules.
 * @file Database schema CLI command.
 * @module modules/core/database/cli/schema
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import type { IInstalledSchema, IModuleSchema } from '@/modules/core/database/types/schema.types';

/**
 * Valid actions for the schema command.
 */
type SchemaAction = 'list' | 'init' | 'validate';

/**
 * List installed schemas.
 * @param context - CLI context.
 * @param _context
 * @returns Promise that resolves when complete.
 */
async function listSchemas(_context: ICLIContext): Promise<void> {
  const dbService = DatabaseService.getInstance();
  const schemaService = SchemaService.getInstance();

  const isInitialized = await dbService.isInitialized();
  if (!isInitialized) {
    console.log('Database is not initialized. No schemas installed.');
    return;
  }

  const schemas = await schemaService.getInstalledSchemas();
  if (schemas.length === 0) {
    console.log('No schemas found.');
    return;
  }

  console.log('\nInstalled Schemas:\n');
  console.log('Module Name           Version    Installed At');
  console.log('-'.repeat(60));

  schemas.forEach((schema: IInstalledSchema) => {
    const moduleName = schema.moduleName.padEnd(20);
    const version = schema.version.padEnd(10);
    const installedAt = schema.installedAt.split('T')[0];
    console.log(`${moduleName} ${version} ${installedAt}`);
  });
}

/**
 * Initialize database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
async function initSchemas(context: ICLIContext): Promise<void> {
  const dbService = DatabaseService.getInstance();
  const schemaService = SchemaService.getInstance();

  const isInitialized = await dbService.isInitialized();
  if (isInitialized && !context.args.force) {
    console.error('Database is already initialized. Use --force to reinitialize.');
    process.exit(1);
  }

  if (isInitialized && context.args.force) {
    console.log('⚠️  WARNING: Force initializing will reset the database!');
    console.log('This action cannot be undone.\n');
  }

  console.log('Initializing database schema...\n');

  try {
    await schemaService.initializeBaseSchema();
    console.log('✓ Base schema initialized');

    if (context.args.module && context.args.module !== '') {
      const moduleName: string = context.args.module as string;
      console.log(`\nInitializing schema for module: ${moduleName}`);

      const discoveredSchemas = await schemaService.discoverSchemasArray();
      const moduleSchema = discoveredSchemas.find((schema: IModuleSchema) => { return schema.moduleName === moduleName });

      if (!moduleSchema) {
        console.error(`Module '${moduleName}' not found or has no schema.`);
        process.exit(1);
      }

      await schemaService.installModuleSchema(moduleSchema);
      console.log(`✓ Schema for ${moduleName} initialized`);
    } else {
      const discoveredSchemas = await schemaService.discoverSchemasArray();

      if (discoveredSchemas.length > 0) {
        console.log(`\nFound ${discoveredSchemas.length} module schema(s) to install:\n`);

        for (const schema of discoveredSchemas) {
          console.log(`Installing schema for ${schema.moduleName}...`);
          try {
            await schemaService.installModuleSchema(schema);
            console.log('  ✓ Success');
          } catch (error) {
            console.log(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    console.log('\nDatabase initialization complete.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize schema:', errorMessage);
    process.exit(1);
  }
}

/**
 * Validate database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
async function validateSchemas(context: ICLIContext): Promise<void> {
  const dbService = DatabaseService.getInstance();
  const schemaService = SchemaService.getInstance();

  const isInitialized = await dbService.isInitialized();
  if (!isInitialized) {
    console.error('Database is not initialized. Nothing to validate.');
    process.exit(1);
  }

  console.log('Validating database schemas...\n');

  try {
    const [installedSchemas, discoveredSchemas] = await Promise.all([
      schemaService.getInstalledSchemas(),
      schemaService.discoverSchemasArray()
    ]);

    let hasIssues = false;

    if (context.args.module && context.args.module !== '') {
      const moduleName: string = context.args.module as string;
      const installedSchema = installedSchemas.find((schema: IInstalledSchema) => { return schema.moduleName === moduleName });

      if (installedSchema) {
        console.log(`✓ Schema for '${moduleName}' is installed (v${installedSchema.version})`);
      } else {
        console.log(`⚠️  Schema for '${moduleName}' is not installed`);
        hasIssues = true;
      }
    } else {
      for (const discoveredSchema of discoveredSchemas) {
        const installedSchema = installedSchemas.find((schema: IInstalledSchema) => { return schema.moduleName === discoveredSchema.moduleName });

        if (installedSchema) {
          console.log(`✓ Schema for '${discoveredSchema.moduleName}' is installed (v${installedSchema.version})`);
        } else {
          console.log(`⚠️  Schema for '${discoveredSchema.moduleName}' is not installed`);
          hasIssues = true;
        }
      }

      for (const installedSchema of installedSchemas) {
        const discoveredSchema = discoveredSchemas.find((schema: IModuleSchema) => { return schema.moduleName === installedSchema.moduleName });

        if (!discoveredSchema) {
          console.log(`⚠️  Installed schema for '${installedSchema.moduleName}' has no corresponding module`);
          hasIssues = true;
        }
      }
    }

    if (hasIssues) {
      console.log("\n⚠️  Schema validation found issues. Run 'systemprompt database:schema --action=init' to fix.");
      process.exit(1);
    } else {
      console.log('\n✓ All schemas are valid.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Validation failed:', errorMessage);
    process.exit(1);
  }
}

/**
 * Execute the schema command based on the action.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
async function executeSchemaCommand(context: ICLIContext): Promise<void> {
  const action: SchemaAction | undefined = context.args.action as SchemaAction | undefined;

  if (!action) {
    console.error('Unknown action: undefined');
    console.error('Valid actions are: list, init, validate');
    process.exit(1);
  }

  try {
    switch (action) {
      case 'list':
        await listSchemas(context);
        break;
      case 'init':
        await initSchemas(context);
        break;
      case 'validate':
        await validateSchemas(context);
        break;
      default:
        console.error(`Unknown action: ${action}`);
        console.error('Valid actions are: list, init, validate');
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error managing schema:', errorMessage);
    process.exit(1);
  }
}

/**
 * Schema command definition.
 */
export const command = {
  name: 'schema',
  description: 'Manage database schemas',
  options: [
    {
      name: 'action',
      type: 'string' as const,
      description: 'Action to perform (list, init, validate)',
      required: false
    },
    {
      name: 'force',
      type: 'boolean' as const,
      description: 'Force reinitialize database',
      required: false
    },
    {
      name: 'module',
      type: 'string' as const,
      description: 'Specific module to operate on',
      required: false
    }
  ],
  execute: executeSchemaCommand
};
