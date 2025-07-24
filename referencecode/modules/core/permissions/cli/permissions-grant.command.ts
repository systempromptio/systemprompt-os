/**
 * Grant permission command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';
import type { PermissionScope, PermissionConditions } from '../types/index.js';

export function createPermissionsGrantCommand(module: PermissionsModule): Command {
  const cmd = new Command('grant')
    .description('Grant permission to user or role')
    .argument('<target>', 'User ID or role name')
    .argument('<resource>', 'Resource name')
    .argument('<action>', 'Action to grant')
    .option('-r, --role', 'Target is a role, not a user')
    .option('-s, --scope <scope>', 'Permission scope')
    .option('-c, --conditions <json>', 'Permission conditions as JSON')
    .option('--expires <date>', 'Expiration date (ISO format)')
    .option('--granted-by <userId>', 'User granting the permission')
    .action(async (target, resource, action, options) => {
      try {
        let conditions: PermissionConditions | undefined;
        if (options.conditions) {
          try {
            conditions = JSON.parse(options.conditions);
          } catch {
            console.error('Error: Invalid JSON for conditions');
            process.exit(1);
          }
        }
        
        let expiresAt: Date | undefined;
        if (options.expires) {
          expiresAt = new Date(options.expires);
          if (isNaN(expiresAt.getTime())) {
            console.error('Error: Invalid expiration date');
            process.exit(1);
          }
        }
        
        const grantData: Parameters<typeof module.grantPermission>[0] = {
          targetId: target,
          targetType: options.role ? 'role' : 'user',
          resource,
          action,
          scope: options.scope as PermissionScope,
          grantedBy: options.grantedBy
        };
        
        if (conditions) {
          grantData.conditions = conditions;
        }
        
        if (expiresAt) {
          grantData.expiresAt = expiresAt;
        }
        
        await module.grantPermission(grantData);
        
        console.log(`\n✓ Permission granted successfully!`);
        console.log(`  Target: ${target} (${options.role ? 'role' : 'user'})`);
        console.log(`  Resource: ${resource}`);
        console.log(`  Action: ${action}`);
        if (options.scope) {
          console.log(`  Scope: ${options.scope}`);
        }
        if (expiresAt) {
          console.log(`  Expires: ${expiresAt.toISOString()}`);
        }
        console.log();
      } catch (error: any) {
        console.error('Error granting permission:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}