/**
 * Permissions module CLI commands
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import { createPermissionsSubcommand } from './permissions.command.js';
import { createRolesSubcommand } from './roles.command.js';

export function createPermissionsCommand(module: PermissionsModule): Command {
  const cmd = new Command('perms')
    .description('Permission and role management');

  // Add subcommand groups
  cmd.addCommand(createPermissionsSubcommand(module));
  cmd.addCommand(createRolesSubcommand(module));

  return cmd;
}