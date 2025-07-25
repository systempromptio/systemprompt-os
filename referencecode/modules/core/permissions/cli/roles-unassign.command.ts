/**
 * Unassign role command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesUnassignCommand(module: PermissionsModule): Command {
  const cmd = new Command('unassign')
    .description('Remove role from user')
    .argument('<role>', 'Role name')
    .argument('<user>', 'User ID or email')
    .option('--unassigned-by <userId>', 'User removing the role')
    .action(async (roleName, userId, options) => {
      try {
        // Get role by name
        const role = await module.getRole(roleName);
        if (!role) {
          console.error(`Error: Role '${roleName}' not found`);
          process.exit(1);
        }

        await module.unassignRole(userId, role.id, options.unassignedBy);

        console.log('\n✓ Role removed successfully!');
        console.log(`  User: ${userId}`);
        console.log(`  Role: ${role.name}\n`);
      } catch (error: any) {
        console.error('Error removing role:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}