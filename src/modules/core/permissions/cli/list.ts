/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * List permissions CLI command.
 */

import { Command } from 'commander';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service.js';

const NO_PERMISSIONS = 0;
const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for listing permissions.
 * @returns The configured Commander command.
 */
export const createListCommand = (): Command => {
  return new Command('permissions:list')
    .description('List all permissions')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (options): Promise<void> => {
      try {
        const service = PermissionsService.getInstance();
        await service.initialize();

        const permissions = await service.listPermissions();

        if (permissions.length === NO_PERMISSIONS) {
          console.log('No permissions found.');
          return;
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(permissions, null, 2));
          return;
        }

        console.log('Permissions:');
        permissions.forEach((permission): void => {
          console.log(`- ${permission.name} (${permission.resource}:${permission.action})`);
          if (permission.description) {
            console.log(`  ${permission.description}`);
          }
        });
      } catch (error) {
        console.error('Error listing permissions:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
