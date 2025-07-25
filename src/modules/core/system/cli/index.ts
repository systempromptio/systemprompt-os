/**
 * CLI commands index for system module.
 */

import type { Command } from 'commander';
import { createInfoCommand } from '@/modules/core/system/cli/info';
import { createConfigCommand } from '@/modules/core/system/cli/config';
import { createHealthCommand } from '@/modules/core/system/cli/health';

/**
 * Get all CLI commands for the system module.
 * @returns Array of configured Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createInfoCommand(),
    createConfigCommand(),
    createHealthCommand()
  ];
};
