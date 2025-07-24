/**
 * Type definitions for MCP server.
 * @module server/types/mcp
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type express from 'express';

/**
 * Session information for MCP connections.
 */
export interface ISessionInfo {
    server: Server;
    transport: import('@modelcontextprotocol/sdk/server/streamableHttp.js').StreamableHTTPServerTransport;
    createdAt: Date;
    lastAccessed: Date;
}

/**
 * MCP handler interface.
 */
export interface IMCPHandler {
    setupRoutes(app: express.Application): Promise<void>;
    getServerForSession(sessionId: string): Server | undefined;
    getAllServers(): Server[];
    getServer(): Server;
    cleanupSession(sessionId: string): void;
    getActiveSessionCount(): number;
    shutdown(): void;
}

/**
 * MCP handler constants.
 */
export const MCP_CONSTANTS = {
  /**
   * Session timeout in milliseconds (1 hour).
   */
  SESSION_TIMEOUT_MS: 60 * 60 * 1000,
  /**
   * Session check interval in milliseconds (5 minutes).
   */
  SESSION_CHECK_INTERVAL_MS: 5 * 60 * 1000,
  /**
   * Base 10 radix for parseInt.
   */
  RADIX_BASE_10: 10,
  /**
   * Base 36 radix for random string generation.
   */
  RADIX_BASE_36: 36,
  /**
   * Rate limit window in milliseconds (1 minute).
   */
  RATE_LIMIT_WINDOW_MS: 60000,
  /**
   * Maximum requests per rate limit window.
   */
  RATE_LIMIT_MAX_REQUESTS: 100,
  /**
   * Maximum request size (10MB).
   */
  MAX_REQUEST_SIZE_MB: 10,
  /**
   * Bytes per megabyte.
   */
  BYTES_PER_MB: 1024 * 1024,
  /**
   * JSON stringify space.
   */
  JSON_STRINGIFY_SPACE: 2,
  /**
   * Session ID substring start.
   */
  SESSION_ID_SUBSTRING_START: 2,
  /**
   * Session ID substring end.
   */
  SESSION_ID_SUBSTRING_END: 11,
  /**
   * Bad request status code.
   */
  BAD_REQUEST_STATUS: 400,
  /**
   * Not found status code.
   */
  NOT_FOUND_STATUS: 404,
  /**
   * Internal server error status code.
   */
  INTERNAL_SERVER_ERROR_STATUS: 500,
  /**
   * JSON-RPC invalid request error code.
   */
  JSONRPC_INVALID_REQUEST_CODE: -32600,
  /**
   * JSON-RPC session not found error code.
   */
  JSONRPC_SESSION_NOT_FOUND_CODE: -32001,
  /**
   * JSON-RPC internal error code.
   */
  JSONRPC_INTERNAL_ERROR_CODE: -32603,
  /**
   * Zero value.
   */
  ZERO: 0,
  /**
   * Increment value.
   */
  INCREMENT: 1,
} as const;
