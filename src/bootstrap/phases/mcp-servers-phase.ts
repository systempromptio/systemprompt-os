/**
 * MCP servers phase for bootstrap process.
 * Handles setup and initialization of Model Context Protocol servers.
 * @module bootstrap/phases/mcp-servers
 */

import type { Express } from 'express';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { setupMcpServers } from '@/server/mcp/index';
import { loadExpressApp } from '@/bootstrap/express-loader';
import type { McpServersPhaseContext } from '@/types/bootstrap';

/**
 * Execute the MCP servers phase of bootstrap.
 * Sets up Express app and MCP server infrastructure.
 * @param context - The phase context containing logger and optional mcpApp.
 * @returns Promise resolving to the Express application instance.
 */
export const executeMcpServersPhase = async (
  context: McpServersPhaseContext
): Promise<Express> => {
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Setting up MCP servers', {
    category: 'mcp',
    persistToDb: false
  });

  try {
    const mcpApp = context.mcpApp ?? loadExpressApp();

    await setupMcpServers(mcpApp);

    logger.debug(LogSource.BOOTSTRAP, 'MCP servers initialized', {
      category: 'mcp',
      persistToDb: false
    });

    return mcpApp;
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to setup MCP servers', {
      category: 'mcp',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};
