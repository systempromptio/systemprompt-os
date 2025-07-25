/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Manage roles CLI command.
 */

import { Command } from 'commander';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service.js';

const NO_ROLES = 0;
const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for managing roles.
 * @returns The configured Commander command.
 */
export const createRolesCommand = (): Command => {
  return new Command('permissions:roles')
    .description('Manage roles')
    .option('-l, --list', 'List all roles')
    .option('-c, --create <name>', 'Create a new role')
    .option('-d, --description <desc>', 'Role description (with --create)')
    .action(async (options): Promise<void> => {
      try {
        const service = PermissionsService.getInstance();
        await service.initialize();

        if (options.list) {
          const roles = await service.listRoles();

          if (roles.length === NO_ROLES) {
            console.log('No roles found.');
            return;
          }

          console.log('Roles:');
          roles.forEach((role): void => {
            const systemTag = role.isSystem ? ' [SYSTEM]' : '';
            console.log(`- ${role.name}${systemTag}`);
            if (role.description) {
              console.log(`  ${role.description}`);
            }
          });
        } else if (options.create) {
          const role = await service.createRole(options.create, options.description);
          console.log(`Created role: ${role.name}`);
          console.log(`ID: ${role.id}`);
          if (role.description) {
            console.log(`Description: ${role.description}`);
          }
        } else {
          console.log('Use --list to view roles or --create to create a new role');
        }
      } catch (error) {
        console.error('Error managing roles:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
