/**
 * List role members command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesMembersCommand(module: PermissionsModule): Command {
  const cmd = new Command('members')
    .description('List role members')
    .argument('<role>', 'Role name')
    .option('--json', 'Output as JSON')
    .action(async (roleName, options) => {
      try {
        // Get role by name
        const role = await module.getRole(roleName);
        if (!role) {
          console.error(`Error: Role '${roleName}' not found`);
          process.exit(1);
        }

        const members = await module.getRoleMembers(role.id);

        if (options.json) {
          console.log(JSON.stringify(members, null, 2));
        } else {
          console.log(`\nRole: ${role.name}`);
          if (role.description) {
            console.log(`Description: ${role.description}`);
          }

          if (members.length === 0) {
            console.log('\nNo members in this role');
          } else {
            console.log('\nMembers:');
            console.log('User ID                           Assigned At              Assigned By');
            console.log('--------------------------------  -----------------------  --------------------------------');

            members.forEach(member => {
              const userId = member.userId.padEnd(32).substring(0, 32);
              const assignedAt = new Date(member.assignedAt).toISOString().substring(0, 23);
              const assignedBy = (member.assignedBy || '-').padEnd(32).substring(0, 32);

              console.log(`${userId}  ${assignedAt}  ${assignedBy}`);
            });

            console.log(`\nTotal: ${members.length} member(s)`);
          }
          console.log();
        }
      } catch (error: any) {
        console.error('Error listing role members:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}