/**
 * Permissions subcommands
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import { createPermissionsListCommand } from './permissions-list.command.js';
import { createPermissionsCheckCommand } from './permissions-check.command.js';
import { createPermissionsGrantCommand } from './permissions-grant.command.js';
import { createPermissionsRevokeCommand } from './permissions-revoke.command.js';

export function createPermissionsSubcommand(module: PermissionsModule): Command {
  const cmd = new Command('permissions')
    .aliases(['perms', 'perm'])
    .description('Permission management commands');

  // Add subcommands
  cmd.addCommand(createPermissionsListCommand(module));
  cmd.addCommand(createPermissionsCheckCommand(module));
  cmd.addCommand(createPermissionsGrantCommand(module));
  cmd.addCommand(createPermissionsRevokeCommand(module));

  return cmd;
}