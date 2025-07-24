/**
 * Development module CLI commands aggregator.
 */

import type { Command } from 'commander';
import { createDebugCommand } from '@/modules/core/dev/cli/debug.js';

/**
 * Get all CLI commands for the dev module.
 * @returns Array of Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createDebugCommand()
    // Additional commands will be added here
  ];
};