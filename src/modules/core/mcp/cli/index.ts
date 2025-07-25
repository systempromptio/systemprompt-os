/**
 * CLI commands index for MCP module.
 */

import type { Command } from 'commander';
import { createListCommand } from '@/modules/core/mcp/cli/list';
import { createCreateCommand } from '@/modules/core/mcp/cli/create';
import { createDeleteCommand } from '@/modules/core/mcp/cli/delete';

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
