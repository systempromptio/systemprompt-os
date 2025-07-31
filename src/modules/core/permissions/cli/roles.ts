/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Manage roles CLI command.
 */

import { Command } from 'commander';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import type { RolesCommandOptions } from '@/modules/core/permissions/types/manual';

const NO_ROLES = 0;
const ERROR_EXIT_CODE = 1;

/**
 * Handle the list roles operation.
 * @param service - The permissions service.
 */
const handleListRoles = async (service: PermissionsService): Promise<void> => {
  const roles = await service.listRoles();

  if (roles.length === NO_ROLES) {
    console.log('No roles found.');
    return;
  }

  console.log('Roles:');
  roles.forEach((role): void => {
    const systemTag = role.is_system === true ? ' [SYSTEM]' : '';
    console.log(`- ${role.name}${systemTag}`);
    if (role.description !== null && role.description.length > 0) {
      console.log(`  ${role.description}`);
    }
  });
};

/**
 * Handle the create role operation.
 * @param service - The permissions service.
 * @param name - The role name.
 * @param description - The role description.
 */
const handleCreateRole = async (
  service: PermissionsService,
  name: string,
  description: string
): Promise<void> => {
  const role = await service.createRole(name, description);
  console.log(`Created role: ${role.name}`);
  console.log(`ID: ${role.id}`);
  if (role.description !== null && role.description.length > 0) {
    console.log(`Description: ${role.description}`);
  }
};

/**
 * Handle the roles command action.
 * @param options - The command options.
 */
const handleRolesAction = async (options: RolesCommandOptions): Promise<void> => {
  const service = PermissionsService.getInstance();
  await service.initialize();

  if (options.list === true) {
    await handleListRoles(service);
  } else if (typeof options.create === 'string') {
    const description = options.description ?? '';
    await handleCreateRole(service, options.create, description);
  } else {
    console.log('Use --list to view roles or --create to create a new role');
  }
};

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
    .action(async (options: RolesCommandOptions): Promise<void> => {
      try {
        await handleRolesAction(options);
      } catch (error) {
        console.error('Error managing roles:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
