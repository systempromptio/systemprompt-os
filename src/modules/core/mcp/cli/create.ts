/**
 * Create MCP context CLI command.
 * @file Create MCP context CLI command.
 * @module modules/core/mcp/cli/create
 */

import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Create a new MCP context',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const name = 'test-context';
      const model = 'gpt-4';
      const config = {
        maxTokens: 4096,
        temperature: 0.7
      };

      const service = MCPService.getInstance();
      const context = await service.createContext(name, model, config);

      logger.info(LogSource.MCP, `Created MCP context: ${context.name}`);
      logger.info(LogSource.MCP, `ID: ${context.id}`);
      logger.info(LogSource.MCP, `Model: ${context.model}`);
      logger.info(LogSource.MCP, `Max Tokens: ${context.max_tokens}`);
      logger.info(LogSource.MCP, `Temperature: ${context.temperature}`);
    } catch (error) {
      const errorMessage = 'Error creating MCP context';
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(LogSource.MCP, errorMessage, { error: errorObj });
      process.exit(1);
    }
  },
};
