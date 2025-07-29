/**
 * Delete MCP context CLI command.
 * @file Delete MCP context CLI command.
 * @module modules/core/mcp/cli/delete
 */

import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Delete an MCP context',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const service = MCPService.getInstance();
      const contexts = await service.listContexts();

      if (contexts.length === 0) {
        logger.info(LogSource.MCP, 'No MCP contexts found to delete.');
        return;
      }

      const contextToDelete = contexts[0];
      if (!contextToDelete) {
        logger.warn(LogSource.MCP, 'No MCP contexts found to delete');
        return;
      }
      await service.deleteContext(contextToDelete.id);

      logger.info(LogSource.MCP, `Deleted MCP context: ${contextToDelete.name} (${contextToDelete.id})`);
    } catch (error) {
      const errorMessage = 'Error deleting MCP context';
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(LogSource.MCP, errorMessage, { error: errorObj });
      process.exit(1);
    }
  },
};
