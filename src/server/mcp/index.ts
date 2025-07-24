/**
 * MCP server setup and initialization module.
 * @file MCP server setup and initialization.
 * @module server/mcp
 */

import type { Express } from 'express';
import * as path from 'path';
import { initializeMCPServerRegistry } from '@/server/mcp/registry.js';
import { createRemoteMCPServer } from '@/server/mcp/remote/index.js';
import { CustomMCPLoader } from '@/server/mcp/loader.js';
import { LoggerService } from '@/modules/core/logger/index.js';

/**
 * Logger instance.
 */
const logger = LoggerService.getInstance();

/**
 * Set up all MCP servers and register routes.
 * @param {Express} app - Express application instance.
 * @returns {Promise<void>} Promise that resolves when setup is complete.
 */
export const setupMcpServers = async (app: Express): Promise<void> => {
  const registry = initializeMCPServerRegistry();

  const remoteServerConfig = createRemoteMCPServer();
  await registry.registerServer(remoteServerConfig);

  const customLoader = new CustomMCPLoader(registry);
  const customDir = path.join(process.cwd(), 'server', 'mcp', 'custom');

  try {
    await customLoader.loadAllServers(customDir);
  } catch (error) {
    logger.error('Failed to load custom MCP servers:', error);
  }

  await registry.setupRoutes(app);

  logger.info('MCP server setup complete');
};
