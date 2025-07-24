/**
 * Roles subcommands
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import { createRolesListCommand } from './roles-list.command.js';
import { createRolesCreateCommand } from './roles-create.command.js';
import { createRolesUpdateCommand } from './roles-update.command.js';
import { createRolesDeleteCommand } from './roles-delete.command.js';
import { createRolesAssignCommand } from './roles-assign.command.js';
import { createRolesUnassignCommand } from './roles-unassign.command.js';
import { createRolesMembersCommand } from './roles-members.command.js';

export function createRolesSubcommand(module: PermissionsModule): Command {
  const cmd = new Command('roles')
    .alias('role')
    .description('Role management commands');
  
  // Add subcommands
  cmd.addCommand(createRolesListCommand(module));
  cmd.addCommand(createRolesCreateCommand(module));
  cmd.addCommand(createRolesUpdateCommand(module));
  cmd.addCommand(createRolesDeleteCommand(module));
  cmd.addCommand(createRolesAssignCommand(module));
  cmd.addCommand(createRolesUnassignCommand(module));
  cmd.addCommand(createRolesMembersCommand(module));
  
  return cmd;
}