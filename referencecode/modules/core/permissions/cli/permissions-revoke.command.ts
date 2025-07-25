/**
 * Revoke permission command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import type { PermissionScope } from '../types/index.js';

export function createPermissionsRevokeCommand(module: PermissionsModule): Command {
  const cmd = new Command('revoke')
    .description('Revoke permission from user or role')
    .argument('<target>', 'User ID or role name')
    .argument('<resource>', 'Resource name')
    .argument('<action>', 'Action to revoke')
    .option('-r, --role', 'Target is a role, not a user')
    .option('-s, --scope <scope>', 'Permission scope')
    .option('--revoked-by <userId>', 'User revoking the permission')
    .action(async (target, resource, action, options) => {
      try {
        await module.revokePermission(
          target,
          options.role ? 'role' : 'user',
          resource,
          action,
          options.scope as PermissionScope,
          options.revokedBy,
        );

        console.log('\n✓ Permission revoked successfully!');
        console.log(`  Target: ${target} (${options.role ? 'role' : 'user'})`);
        console.log(`  Resource: ${resource}`);
        console.log(`  Action: ${action}`);
        if (options.scope) {
          console.log(`  Scope: ${options.scope}`);
        }
        console.log();
      } catch (error: any) {
        console.error('Error revoking permission:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}