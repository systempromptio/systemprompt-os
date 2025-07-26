/**
 * @file MCP server setup and initialization.
 * @module server/mcp
 * MCP server setup and initialization module.
 */

import type { Express } from 'express';
import * as path from 'path';
import { initializeMcpServerRegistry } from '@/server/mcp/registry';
import { createRemoteMcpServer } from '@/server/mcp/remote/index';
import { CustomMcpLoader } from '@/server/mcp/loader';
import { LogSource, LoggerService } from '@/modules/core/logger/index';
/**
 * Logger instance.
 */
const logger = LoggerService.getInstance();

// Re-export getMCPModule from the module for convenience
export { getMCPModule } from '@/modules/core/mcp/index';

/**
 * Set up all MCP servers and register routes.
 * @param app - Express application instance.
 * @returns Promise that resolves when setup is complete.
 */
export const setupMcpServers = async (app: Express): Promise<void> => {
  const registry = initializeMcpServerRegistry();

  const remoteServerConfig = createRemoteMcpServer();
  await registry.registerServer(remoteServerConfig);

  const customLoader = new CustomMcpLoader(registry);
  const customDir = path.join(process.cwd(), 'server', 'mcp', 'custom');

  try {
    await customLoader.loadAllServers(customDir);
  } catch (error) {
    logger.error(LogSource.MCP, 'Failed to load custom MCP servers', { error: error instanceof Error ? error : String(error) });
  }

  await registry.setupRoutes(app);

  logger.info(LogSource.MCP, 'MCP server setup complete');
};
