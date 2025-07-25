/**
 * Remote MCP server with HTTP transport providing core functionality.
 * @file Remote MCP server with HTTP transport.
 * @module server/mcp/remote
 */

import { type ILocalMcpServer, McpServerTypeEnum } from '@/server/mcp/types';
import type { RequestHandler } from 'express';
import { CoreMcpServer } from '@/server/mcp/remote/core-server';

/**
 * Create the remote MCP server configuration.
 * @returns Remote MCP server configuration.
 */
export const createRemoteMcpServer = function createRemoteMcpServer(): ILocalMcpServer {
  const server = new CoreMcpServer();

  return {
    id: 'core',
    name: 'systemprompt-os-core',
    version: '0.1.0',
    type: McpServerTypeEnum.LOCAL,
    description: 'Core MCP server with resource, prompt, and tool capabilities',
    createHandler: (): RequestHandler => {
      return server.handleRequest.bind(server);
    },
    getActiveSessionCount: (): number => {
      return server.getActiveSessionCount();
    },
    shutdown: (): void => {
      server.shutdown();
    }
  };
};
