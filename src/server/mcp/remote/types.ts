/**
 * Remote MCP server types.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * Represents an active MCP session with its associated server and transport.
 */
export interface ISessionInfo {
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastAccessed: Date;
}

/**
 * Configuration options for the MCP server.
 */
export interface IServerConfig {
  name?: string;
  version?: string;
  sessionTimeoutMs?: number;
  cleanupIntervalMs?: number;
}
