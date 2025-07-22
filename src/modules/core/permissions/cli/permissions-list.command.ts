/**
 * List permissions command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createPermissionsListCommand(module: PermissionsModule): Command {
  const cmd = new Command('list')
    .alias('ls')
    .description('List permissions')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-r, --role <role>', 'Filter by role')
    .option('--resource <resource>', 'Filter by resource')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        let permissions;
        
        if (options.user) {
          // Get user permissions
          permissions = await module.getUserPermissions(options.user);
        } else if (options.role) {
          // Get role permissions
          permissions = await module.getRolePermissions(options.role);
        } else {
          // List all permissions with filter
          permissions = await module.listPermissions({
            resource: options.resource
          });
        }
        
        if (options.json) {
          console.log(JSON.stringify(permissions, null, 2));
        } else {
          if (permissions.length === 0) {
            console.log('No permissions found');
            return;
          }
          
          console.log('\nPermissions:');
          console.log('Resource              Action              Scope');
          console.log('-------------------   -----------------   --------');
          
          permissions.forEach(perm => {
            const resource = perm.resource.padEnd(20).substring(0, 20);
            const action = perm.action.padEnd(18).substring(0, 18);
            const scope = perm.scope || 'all';
            
            console.log(`${resource} ${action} ${scope}`);
          });
          
          console.log(`\nTotal: ${permissions.length} permission(s)\n`);
        }
      } catch (error: any) {
        console.error('Error listing permissions:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}