/**
 * @fileoverview Modules CLI commands registry
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';

// Import all module commands
import { createListCommand } from './list.js';
import { createInstallCommand } from './install.js';
import { createRemoveCommand } from './remove.js';
import { createValidateCommand } from './validate.js';
import { createInfoCommand } from './info.js';
import { createCreateCommand } from './create.js';
import { createEnableCommand } from './enable.js';
import { createDisableCommand } from './disable.js';
import { createRestartCommand } from './restart.js';
import { createLogsCommand } from './logs.js';
import { createConfigCommand } from './config.js';
import { createHealthCommand } from './health.js';

export function createModulesCommand(service: ModuleManagerService, logger?: Logger): Command {
  const command = new Command('modules')
    .description('Module management commands')
    .alias('module');

  // Add all commands
  command.addCommand(createListCommand(service, logger));
  command.addCommand(createInstallCommand(service, logger));
  command.addCommand(createRemoveCommand(service, logger));
  command.addCommand(createValidateCommand(service, logger));
  command.addCommand(createInfoCommand(service, logger));
  command.addCommand(createCreateCommand(service, logger));
  command.addCommand(createEnableCommand(service, logger));
  command.addCommand(createDisableCommand(service, logger));
  command.addCommand(createRestartCommand(service, logger));
  command.addCommand(createLogsCommand(service, logger));
  command.addCommand(createConfigCommand(service, logger));
  command.addCommand(createHealthCommand(service, logger));

  return command;
}