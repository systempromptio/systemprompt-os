/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Delete MCP context CLI command.
 */

import { Command } from 'commander';
import { MCPService } from '@/modules/core/mcp/services/mcp.service.js';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for deleting MCP contexts.
 * @returns The configured Commander command.
 */
export const createDeleteCommand = (): Command => {
  return new Command('mcp:delete')
    .description('Delete an MCP context')
    .requiredOption('-i, --id <id>', 'Context ID')
    .action(async (options): Promise<void> => {
      try {
        const service = MCPService.getInstance();
        await service.initialize();

        await service.deleteContext(options.id);
        console.log(`Deleted MCP context: ${options.id}`);
      } catch (error) {
        console.error('Error deleting MCP context:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
