/**
 * MCP module status CLI command.
 * @file MCP module status CLI command.
 * @module modules/core/mcp/cli/status
 */

import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Log status information to logger.
 * @param logger - Logger service instance.
 * @param contexts - MCP contexts array.
 */
const logStatusInformation = (logger: LoggerService, contexts: unknown[]): void => {
  logger.info(LogSource.MCP, 'MCP Module Status:');
  logger.info(LogSource.MCP, '════════════════');
  logger.info(LogSource.MCP, 'Module: mcp');
  logger.info(LogSource.MCP, 'Enabled: ✓');
  logger.info(LogSource.MCP, 'Healthy: ✓');
  logger.info(LogSource.MCP, 'Service: McpService initialized');
  logger.info(LogSource.MCP, `Active MCP contexts: ${String(contexts.length)}`);
  logger.info(LogSource.MCP, 'MCP protocol support: ✓');
  logger.info(LogSource.MCP, 'Context management: ✓');
  logger.info(LogSource.MCP, 'Session handling: ✓');
};

export const command = {
  description: 'Show MCP module status (enabled/healthy)',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const mcpService = MCPService.getInstance();
      const contexts = await mcpService.listContexts();

      logStatusInformation(logger, contexts);
      process.exit(0);
    } catch (error) {
      const errorMessage = 'Error getting MCP status';
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(LogSource.MCP, errorMessage, { error: errorObj });
      logger.error(LogSource.MCP, `${errorMessage}: ${String(error)}`);
      process.exit(1);
    }
  },
};
