/**
 * Users module CLI commands
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';
import { createListCommand } from './list.command.js';
import { createCreateCommand } from './create.command.js';
import { createUpdateCommand } from './update.command.js';
import { createDeleteCommand } from './delete.command.js';
import { createEnableCommand } from './enable.command.js';
import { createDisableCommand } from './disable.command.js';
import { createSessionsCommand } from './sessions.command.js';
import { createActivityCommand } from './activity.command.js';

export function createUsersCommand(module: UsersModule): Command {
  const cmd = new Command('users')
    .alias('user')
    .description('User management commands');

  // Add subcommands
  cmd.addCommand(createListCommand(module));
  cmd.addCommand(createCreateCommand(module));
  cmd.addCommand(createUpdateCommand(module));
  cmd.addCommand(createDeleteCommand(module));
  cmd.addCommand(createEnableCommand(module));
  cmd.addCommand(createDisableCommand(module));
  cmd.addCommand(createSessionsCommand(module));
  cmd.addCommand(createActivityCommand(module));

  return cmd;
}