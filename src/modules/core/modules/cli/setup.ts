/**
 * Module setup CLI command.
 * Handles database seeding and maintenance for modules.
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ModuleSetupService } from '@/modules/core/modules/services/module-setup.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types';
import type { SetupArgs } from '@/modules/core/cli/types/cli.types';

export const command = 'module:setup <action>';
export const describe = 'Setup and maintain module database';

export const builder = {
  action: {
    describe: 'Action to perform',
    choices: ['install', 'clean', 'update', 'validate'],
    demandOption: true
  },
  force: {
    describe: 'Force operation without confirmation',
    type: 'boolean',
    default: false
  }
};

export const handler = async (argv: SetupArgs): Promise<void> => {
  const logger = LoggerService.getInstance();
  const database = DatabaseService.getInstance();
  const setupService = ModuleSetupService.getInstance(database);

  try {
    switch (argv.action) {
      case 'install':
        logger.info(LogSource.CLI, 'Installing core modules...');
        await setupService.install();
        logger.info(LogSource.CLI, 'Core modules installed successfully');
        break;

      case 'clean':
        if (!argv.force) {
          logger.error(
            LogSource.CLI,
            'Clean operation requires --force flag to confirm data loss'
          );
          process.exit(1);
        }
        logger.warn(LogSource.CLI, 'Cleaning and rebuilding module database...');
        await setupService.clean();
        logger.info(LogSource.CLI, 'Module database rebuilt successfully');
        break;

      case 'update':
        logger.info(LogSource.CLI, 'Updating core module definitions...');
        await setupService.update();
        logger.info(LogSource.CLI, 'Core modules updated successfully');
        break;

      case 'validate':
        logger.info(LogSource.CLI, 'Validating module database...');
        await setupService.validate();
        logger.info(LogSource.CLI, 'Module database validation passed');
        break;
    }
  } catch (error) {
    logger.error(LogSource.CLI, `Module setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};
