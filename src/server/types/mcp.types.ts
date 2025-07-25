/**
 * Type definitions for MCP server.
 * @module server/types/mcp
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  StreamableHTTPServerTransport
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type express from 'express';

/**
 * Session information for MCP connections.
 */
export interface ISessionInfo {
    server: Server;
    transport: StreamableHTTPServerTransport;
    createdAt: Date;
    lastAccessed: Date;
}

/**
 * MCP handler interface.
 */
export interface IMcpHandler {
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
  sessionTimeoutMs: 60 * 60 * 1000,
  /**
   * Session check interval in milliseconds (5 minutes).
   */
  sessionCheckIntervalMs: 5 * 60 * 1000,
  /**
   * Base 10 radix for parseInt.
   */
  radixBase10: 10,
  /**
   * Base 36 radix for random string generation.
   */
  radixBase36: 36,
  /**
   * Rate limit window in milliseconds (1 minute).
   */
  rateLimitWindowMs: 60000,
  /**
   * Maximum requests per rate limit window.
   */
  rateLimitMaxRequests: 100,
  /**
   * Maximum request size (10MB).
   */
  maxRequestSizeMb: 10,
  /**
   * Bytes per megabyte.
   */
  bytesPerMb: 1024 * 1024,
  /**
   * JSON stringify space.
   */
  jsonStringifySpace: 2,
  /**
   * Session ID substring start.
   */
  sessionIdSubstringStart: 2,
  /**
   * Session ID substring end.
   */
  sessionIdSubstringEnd: 11,
  /**
   * Bad request status code.
   */
  badRequestStatus: 400,
  /**
   * Not found status code.
   */
  notFoundStatus: 404,
  /**
   * Internal server error status code.
   */
  internalServerErrorStatus: 500,
  /**
   * JSON-RPC invalid request error code.
   */
  jsonrpcInvalidRequestCode: -32600,
  /**
   * JSON-RPC session not found error code.
   */
  jsonrpcSessionNotFoundCode: -32001,
  /**
   * JSON-RPC internal error code.
   */
  jsonrpcInternalErrorCode: -32603,
  /**
   * Zero value.
   */
  zero: 0,
  /**
   * Increment value.
   */
  increment: 1,
} as const;
