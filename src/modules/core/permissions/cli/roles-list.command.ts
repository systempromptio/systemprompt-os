/**
 * List roles command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesListCommand(module: PermissionsModule): Command {
  const cmd = new Command('list')
    .alias('ls')
    .description('List roles')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const roles = await module.listRoles();
        
        if (options.json) {
          console.log(JSON.stringify(roles, null, 2));
        } else {
          if (roles.length === 0) {
            console.log('No roles found');
            return;
          }
          
          console.log('\nRoles:');
          console.log('Name              Description                               System');
          console.log('----------------  ----------------------------------------  --------');
          
          for (const role of roles) {
            const name = role.name.padEnd(16).substring(0, 16);
            const desc = (role.description || '').padEnd(40).substring(0, 40);
            const system = role.isSystem ? 'Yes' : 'No';
            
            console.log(`${name}  ${desc}  ${system}`);
          }
          
          console.log(`\nTotal: ${roles.length} role(s)\n`);
        }
      } catch (error: any) {
        console.error('Error listing roles:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}