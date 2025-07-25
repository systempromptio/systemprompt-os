/**
 * Development module CLI commands aggregator.
 */

import type { Command } from 'commander';
import { createDebugCommand } from '@/modules/core/dev/cli/debug';

/**
 * Get all CLI commands for the dev module.
 * @returns Array of Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createDebugCommand()
  ];
};
