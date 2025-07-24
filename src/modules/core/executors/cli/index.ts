/**
 * CLI commands index for executors module.
 */

import type { Command } from 'commander';
import { createListCommand } from '@/modules/core/executors/cli/list.js';

/**
 * Get all CLI commands for the executors module.
 * @returns Array of configured Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createListCommand()
  ];
};
