/**
 * CLI commands index for permissions module.
 */

import type { Command } from 'commander';
import { createListCommand } from '@/modules/core/permissions/cli/list.js';
import { createRolesCommand } from '@/modules/core/permissions/cli/roles.js';
import { createGrantCommand } from '@/modules/core/permissions/cli/grant.js';

/**
 * Get all CLI commands for the permissions module.
 * @returns Array of configured Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createListCommand(),
    createRolesCommand(),
    createGrantCommand()
  ];
};