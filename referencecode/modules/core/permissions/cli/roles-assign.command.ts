/**
 * Assign role command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesAssignCommand(module: PermissionsModule): Command {
  const cmd = new Command('assign')
    .description('Assign role to user')
    .argument('<role>', 'Role name')
    .argument('<user>', 'User ID or email')
    .option('--assigned-by <userId>', 'User assigning the role')
    .action(async (roleName, userId, options) => {
      try {
        // Get role by name
        const role = await module.getRole(roleName);
        if (!role) {
          console.error(`Error: Role '${roleName}' not found`);
          process.exit(1);
        }
        
        await module.assignRole(userId, role.id, options.assignedBy);
        
        console.log(`\n✓ Role assigned successfully!`);
        console.log(`  User: ${userId}`);
        console.log(`  Role: ${role.name}`);
        if (role.description) {
          console.log(`  Description: ${role.description}`);
        }
        console.log();
      } catch (error: any) {
        console.error('Error assigning role:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}