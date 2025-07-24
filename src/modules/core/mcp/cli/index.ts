/**
 * CLI commands index for MCP module.
 */

import type { Command } from 'commander';
import { createListCommand } from '@/modules/core/mcp/cli/list.js';
import { createCreateCommand } from '@/modules/core/mcp/cli/create.js';
import { createDeleteCommand } from '@/modules/core/mcp/cli/delete.js';

/**
 * Get all CLI commands for the MCP module.
 * @returns Array of configured Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createListCommand(),
    createCreateCommand(),
    createDeleteCommand()
  ];
};