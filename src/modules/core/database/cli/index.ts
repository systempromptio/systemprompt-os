/**
 * @file Database CLI commands registry.
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';

// Import existing commands - they will need to be converted to createCommand pattern later

// Import new data commands
import { createExportCommand } from '@/modules/core/database/cli/export.js';
import { createImportCommand } from '@/modules/core/database/cli/import.js';
import { createBackupCommand } from '@/modules/core/database/cli/backup.js';
import { createRestoreCommand } from '@/modules/core/database/cli/restore.js';
import { createValidateCommand } from '@/modules/core/database/cli/validate.js';
import { createCleanCommand } from '@/modules/core/database/cli/clean.js';
import { createDataMigrateCommand } from '@/modules/core/database/cli/data-migrate.js';

export function createDatabaseCommand(db: DatabaseService, logger: ILogger): Command {
  const command = new Command('database')
    .description('Database management commands')
    .alias('db');

  /*
   * TODO: Add existing commands once they are converted to createCommand pattern
   * command.addCommand(createMigrateCommand(db, logger));
   * command.addCommand(createQueryCommand(db, logger));
   * command.addCommand(createRollbackCommand(db, logger));
   * command.addCommand(createSchemaCommand(db, logger));
   * command.addCommand(createStatusCommand(db, logger));
   */

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
