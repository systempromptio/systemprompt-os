/**
 * Create role command
 */

import { Command } from 'commander';
import type { PermissionsModule } from '../index.js';

export function createRolesCreateCommand(module: PermissionsModule): Command {
  const cmd = new Command('create')
    .description('Create a new role')
    .argument('<name>', 'Role name')
    .option('-d, --description <description>', 'Role description')
    .option('-p, --permissions <json>', 'Initial permissions as JSON array')
    .option('--created-by <userId>', 'User creating the role')
    .action(async (name, options) => {
      try {
        let permissions;
        if (options.permissions) {
          try {
            permissions = JSON.parse(options.permissions);
            // Validate permissions structure
            if (!Array.isArray(permissions)) {
              throw new Error('Permissions must be an array');
            }
            permissions.forEach((perm: any) => {
              if (!perm.resource || !perm.action) {
                throw new Error('Each permission must have resource and action');
              }
            });
          } catch (error: any) {
            console.error(`Error: Invalid permissions JSON - ${error.message}`);
            process.exit(1);
          }
        }

        const roleData: Parameters<typeof module.createRole>[0] = {
          name,
          description: options.description,
        };

        if (permissions) {
          roleData.permissions = permissions;
        }

        const role = await module.createRole(roleData, options.createdBy);

        console.log('\n✓ Role created successfully!');
        console.log(`  ID: ${role.id}`);
        console.log(`  Name: ${role.name}`);
        if (role.description) {
          console.log(`  Description: ${role.description}`);
        }
        console.log(`  Created: ${role.createdAt.toISOString()}`);

        if (permissions && permissions.length > 0) {
          console.log('\n  Initial permissions:');
          permissions.forEach((perm: any) => {
            console.log(`    - ${perm.resource}:${perm.action}${perm.scope ? `:${perm.scope}` : ''}`);
          });
        }
        console.log();
      } catch (error: any) {
        console.error('Error creating role:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}