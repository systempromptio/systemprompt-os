/**
 * Check permission command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import type { PermissionScope } from '../types/index.js';

export function createPermissionsCheckCommand(module: PermissionsModule): Command {
  const cmd = new Command('check')
    .description('Check if user has permission')
    .argument('<user>', 'User ID or email')
    .argument('<resource>', 'Resource name')
    .argument('<action>', 'Action to check')
    .option('-s, --scope <scope>', 'Permission scope (self, all, team, organization)')
    .action(async (user, resource, action, options) => {
      try {
        const result = await module.checkPermission({
          userId: user,
          resource,
          action,
          scope: options.scope as PermissionScope
        });
        
        if (result.allowed) {
          console.log(`✓ Permission GRANTED`);
          console.log(`  User: ${user}`);
          console.log(`  Resource: ${resource}`);
          console.log(`  Action: ${action}`);
          if (options.scope) {
            console.log(`  Scope: ${options.scope}`);
          }
          console.log(`  Matched by: ${result.matchedBy}`);
        } else {
          console.log(`✗ Permission DENIED`);
          console.log(`  User: ${user}`);
          console.log(`  Resource: ${resource}`);
          console.log(`  Action: ${action}`);
          if (options.scope) {
            console.log(`  Scope: ${options.scope}`);
          }
          if (result.reason) {
            console.log(`  Reason: ${result.reason}`);
          }
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error checking permission:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}