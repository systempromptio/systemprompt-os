/**
 * List MCP contexts CLI command.
 * @file List MCP contexts CLI command.
 * @module modules/core/mcp/cli/list
 */

import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'List all configured MCP contexts',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const service = MCPService.getInstance();
      const contexts = await service.listContexts();

      if (contexts.length === 0) {
        logger.info(LogSource.MCP, 'No MCP contexts found.');
        return;
      }

      logger.info(LogSource.MCP, 'MCP Contexts:');
      contexts.forEach((context): void => {
        logger.info(LogSource.MCP, `- ${context.name} (${context.model})`);
        logger.info(LogSource.MCP, `  ID: ${context.id}`);
        logger.info(LogSource.MCP, `  Max Tokens: ${context.max_tokens}`);
        logger.info(LogSource.MCP, `  Temperature: ${context.temperature}`);
      });
    } catch (error) {
      const errorMessage = 'Error listing MCP contexts';
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(LogSource.MCP, errorMessage, { error: errorObj });
      process.exit(1);
    }
  },
};
