/**
 * MCP servers phase for bootstrap process.
 * Handles setup and initialization of Model Context Protocol servers.
 * @module bootstrap/phases/mcp-servers
 */

import type { Express } from 'express';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { setupMcpServers } from '@/server/mcp/index';
import { loadExpressApp } from '@/bootstrap/express-loader';

export interface McpServersPhaseContext {
  logger: ILogger;
  mcpApp?: Express;
}

/**
 * Execute the MCP servers phase of bootstrap.
 * Sets up Express app and MCP server infrastructure.
 * @param context
 */
export async function executeMcpServersPhase(context: McpServersPhaseContext): Promise<Express> {
  const { logger } = context;

  logger.debug(LogSource.BOOTSTRAP, 'Setting up MCP servers', {
    category: 'mcp',
    persistToDb: false
  });

  try {
    const mcpApp = await loadExpressApp();

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
}
