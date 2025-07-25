/**
 * Type definitions for MCP server including session management,
 * error codes, and request context structures.
 * @file Type definitions for MCP server including session management,
 * error codes, and request context structures.
 * @module server/types/session
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  StreamableHTTPServerTransport
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * MCP session data.
 */
export interface IMcpSession {
  id: string;
  transport: StreamableHTTPServerTransport;
  server: Server;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * Session manager configuration.
 */
export interface ISessionConfig {
  sessionTimeout: number;
  maxSessions?: number;
  onSessionExpired?: (sessionId: string) => void;
}

/**
 * MCP error codes following JSON-RPC 2.0 specification.
 * @example
 * ```typescript
 * res.status(400).json({
 *   jsonrpc: '2.0',
 *   error: {
 *     code: McpErrorCodeEnum.INVALID_REQUEST,
 *     message: 'Invalid request format'
 *   },
 *   id: null
 * });
 * ```
 */
export const enum McpErrorCodeEnum {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
}

/**
 * MCP request context for tracking and auditing.
 */
export interface IMcpRequestContext {
  requestId: string;
  sessionId?: string;
  auth?: unknown;
  startTime: number;
}
