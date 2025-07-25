/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Grant permissions CLI command.
 */

import { Command } from 'commander';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for granting permissions.
 * @returns The configured Commander command.
 */
export const createGrantCommand = (): Command => {
  return new Command('permissions:grant')
    .description('Grant permissions to a role')
    .requiredOption('-r, --role <role>', 'Role ID')
    .requiredOption('-p, --permission <permission>', 'Permission ID')
    .action(async (options): Promise<void> => {
      try {
        const service = PermissionsService.getInstance();
        await service.initialize();

        await service.grantPermission(options.role, options.permission);
        console.log(`Granted permission ${options.permission} to role ${options.role}`);
      } catch (error) {
        console.error('Error granting permission:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
