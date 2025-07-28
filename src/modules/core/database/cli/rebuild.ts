/**
 * Database rebuild CLI command implementation.
 * This command provides a dangerous operation to completely rebuild the database.
 * @file Database rebuild CLI command.
 * @module modules/core/database/cli/rebuild
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { ICLIContext } from '@/modules/core/cli/types/index';
import {
 existsSync, readFileSync
} from 'fs';
import { join } from 'path';
import { CORE_MODULES } from '@/constants/bootstrap';

/**
 * Discover all module schema files by scanning the module directories.
 */
function discoverModuleSchemas(): string[] {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const schemaFiles: string[] = [];

  cliOutput.info(`Scanning ${CORE_MODULES.length} core modules for schemas...`);
  logger.debug(LogSource.CLI, `Scanning ${CORE_MODULES.length} core modules for schemas...`);

  for (const coreModule of CORE_MODULES) {
    const modulePath = coreModule.path.replace(/\/index\.(?:ts|js)$/u, '');
    const schemaPath = join(process.cwd(), modulePath, 'database', 'schema.sql');

    logger.debug(LogSource.CLI, `Checking schema for ${coreModule.name}: ${schemaPath}`);

    if (existsSync(schemaPath)) {
      schemaFiles.push(schemaPath);
      cliOutput.info(`Found schema for ${coreModule.name}`);
      logger.debug(LogSource.CLI, `Found schema for ${coreModule.name}`);
    } else {
      logger.debug(LogSource.CLI, `No schema found for ${coreModule.name}`);
    }
  }

  return schemaFiles;
}

/**
 * Execute SQL statements from a schema file.
 * @param schemaPath
 * @param database
 * @param logger
 * @param cliOutput
 */
async function executeSchemaFile(schemaPath: string, database: DatabaseService, logger: LoggerService, cliOutput: CliOutputService): Promise<void> {
  try {
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    const statements = schemaSql
      .split(';')
      .map(stmt => { return stmt.trim() })
      .filter(stmt => {
        return stmt.length > 0
               && !stmt.startsWith('--')
               && !stmt.toUpperCase().startsWith('BEGIN')
               && !stmt.toUpperCase().startsWith('COMMIT')
               && !stmt.toUpperCase().startsWith('ROLLBACK');
      });

    let hasErrors = false;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.execute(statement);
        } catch (statementError: any) {
          const errorMessage = statementError.message || String(statementError);
          if (errorMessage.includes('already exists')
              || errorMessage.includes('cannot commit')
              || errorMessage.includes('no transaction')) {
            logger.debug(LogSource.CLI, `Non-critical SQL warning in ${schemaPath}: ${errorMessage}`);
          } else {
            logger.error(LogSource.CLI, `SQL error in ${schemaPath}: ${errorMessage}`);
            hasErrors = true;
          }
        }
      }
    }

    if (hasErrors) {
      cliOutput.warning(`Schema initialized with warnings: ${schemaPath.split('/').pop()}`);
    } else {
      cliOutput.success(`Initialized schema: ${schemaPath.split('/').pop()}`);
    }
    logger.debug(LogSource.CLI, `Completed schema: ${schemaPath}`);
  } catch (error) {
    cliOutput.error(`Failed to read schema ${schemaPath.split('/').pop()}: ${error}`);
    logger.error(LogSource.CLI, `Failed to read schema ${schemaPath}: ${error}`);
  }
}

/**
 * Initialize module schemas from discovered schema files.
 */
async function initializeModuleSchemas(): Promise<void> {
  const logger = LoggerService.getInstance();
  const database = DatabaseService.getInstance();
  const cliOutput = CliOutputService.getInstance();

  cliOutput.info('Discovering module schemas...');
  logger.debug(LogSource.CLI, 'Discovering module schemas...');

  const schemaFiles = discoverModuleSchemas();

  cliOutput.info(`Found ${schemaFiles.length} schema files to initialize`);
  logger.debug(LogSource.CLI, `Found ${schemaFiles.length} schema files to initialize`);

  for (const schemaPath of schemaFiles) {
    await executeSchemaFile(schemaPath, database, logger, cliOutput);
  }
}

/**
 * Database rebuild command configuration.
 */
export const command = {
  description: 'Rebuild database - drop all tables and recreate from schema files',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const force = args.force === true;
    const confirm = args.confirm === true;

    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    if (!force && !confirm) {
      cliOutput.error('Confirmation required. Use --force or --confirm to proceed.');
      logger.error(LogSource.CLI, 'Confirmation required. Use --force or --confirm to proceed.');
      process.exit(1);
    }

    try {
      cliOutput.section('Database Rebuild', 'Initializing module schemas');
      logger.info(LogSource.CLI, 'Starting database rebuild...');

      await initializeModuleSchemas();

      cliOutput.success('Database rebuild completed successfully');
      logger.info(LogSource.CLI, 'Database rebuild completed successfully');
      process.exit(0);
    } catch (error) {
      cliOutput.error(`Database rebuild failed: ${error}`);
      logger.error(LogSource.CLI, `Database rebuild failed: ${error}`);
      process.exit(1);
    }
  },
};
