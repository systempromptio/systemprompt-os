/**
 * @file Remote MCP server with HTTP transport.
 * @module server/mcp/remote
 */

import type { ILocalMCPServer } from '@/server/mcp/types.js';
import { MCPServerType } from '@/server/mcp/types.js';
import { CoreMCPServer } from '@/server/mcp/remote/core-server.js';

/**
 * Create the remote MCP server configuration.
 * @returns Remote MCP server configuration.
 */
export const createRemoteMCPServer = function (): ILocalMCPServer {
  const server = new CoreMCPServer();

  return {
    id: 'core',
    name: 'systemprompt-os-core',
    version: '0.1.0',
    type: MCPServerType.LOCAL,
    description: 'Core MCP server with resource, prompt, and tool capabilities',
    createHandler: () => { return server.handleRequest.bind(server) },
    getActiveSessionCount: () => { return server.getActiveSessionCount() },
    shutdown: () => { server.shutdown(); }
  };
}
