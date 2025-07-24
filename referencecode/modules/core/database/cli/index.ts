/**
 * @fileoverview Database CLI commands registry
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { DatabaseService } from '../services/database.service.js';

// Import existing commands - they will need to be converted to createCommand pattern later

// Import new data commands
import { createExportCommand } from './export.js';
import { createImportCommand } from './import.js';
import { createBackupCommand } from './backup.js';
import { createRestoreCommand } from './restore.js';
import { createValidateCommand } from './validate.js';
import { createCleanCommand } from './clean.js';
import { createDataMigrateCommand } from './data-migrate.js';

export function createDatabaseCommand(db: DatabaseService, logger: Logger): Command {
  const command = new Command('database')
    .description('Database management commands')
    .alias('db');

  // TODO: Add existing commands once they are converted to createCommand pattern
  // command.addCommand(createMigrateCommand(db, logger));
  // command.addCommand(createQueryCommand(db, logger));
  // command.addCommand(createRollbackCommand(db, logger));
  // command.addCommand(createSchemaCommand(db, logger));
  // command.addCommand(createStatusCommand(db, logger));
  
  // Add data sub-command group
  const dataCommand = new Command('data')
    .description('Data management commands');
  
  dataCommand.addCommand(createExportCommand(db, logger));
  dataCommand.addCommand(createImportCommand(db, logger));
  dataCommand.addCommand(createBackupCommand(db, logger));
  dataCommand.addCommand(createRestoreCommand(db, logger));
  dataCommand.addCommand(createValidateCommand(db, logger));
  dataCommand.addCommand(createCleanCommand(db, logger));
  dataCommand.addCommand(createDataMigrateCommand(db, logger));
  
  command.addCommand(dataCommand);

  return command;
}