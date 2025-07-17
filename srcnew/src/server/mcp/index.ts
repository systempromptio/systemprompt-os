/**
 * @fileoverview MCP server setup and initialization
 * @module server/mcp
 * 
 * @remarks
 * This module initializes the MCP server system, including:
 * - Core MCP server (always available)
 * - Custom local embedded servers
 * - Remote server configurations
 */

import { Express } from 'express';
import { initializeMCPServerRegistry } from './registry.js';
import { CoreMCPServer } from './core/server.js';
import { CustomMCPLoader } from './custom-loader.js';
import { MCPServerType, LocalMCPServer } from './types.js';
import * as path from 'path';

/**
 * Set up all MCP servers and register routes
 * 
 * @param app - Express application instance
 * @returns Promise that resolves when setup is complete
 */
export async function setupMCPServers(app: Express): Promise<void> {
  const registry = initializeMCPServerRegistry();
  
  // Register core MCP server (always available)
  const coreServer = new CoreMCPServer();
  const coreServerConfig: LocalMCPServer = {
    id: 'core',
    name: coreServer.name,
    version: coreServer.version,
    type: MCPServerType.LOCAL,
    description: 'Core SystemPrompt MCP server with basic tools and resources',
    createHandler: () => coreServer.handleRequest.bind(coreServer),
    getActiveSessionCount: () => coreServer.getActiveSessionCount(),
    shutdown: () => coreServer.shutdown()
  };
  
  await registry.registerServer(coreServerConfig);
  
  // Load custom MCP servers
  const customLoader = new CustomMCPLoader(registry);
  const customDir = path.join(process.cwd(), 'server', 'mcp', 'custom');
  
  try {
    await customLoader.loadAllServers(customDir);
  } catch (error) {
    console.error('❌ Failed to load custom MCP servers:', error);
  }
  
  // Set up HTTP routes for all registered servers
  await registry.setupRoutes(app);
  
  console.log('✅ MCP server setup complete');
}