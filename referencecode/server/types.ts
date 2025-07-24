/**
 * @fileoverview Type definitions for MCP server including session management,
 * error codes, and request context structures.
 * @module server/types
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * MCP session data
 */
export interface MCPSession {
  id: string;
  transport: StreamableHTTPServerTransport;
  server: Server;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * Session manager configuration
 */
export interface SessionConfig {
  sessionTimeout: number;
  maxSessions?: number;
  onSessionExpired?: ( sessionId: string) => void;
}

/**
 * MCP error codes following JSON-RPC 2.0 specification
 * @example
 * ```typescript
 * res.status(400).json({
 *   jsonrpc: '2.0',
 *   error: {
 *     code: MCPErrorCode.InvalidRequest,
 *     message: 'Invalid request format'
 *   },
 *   id: null
 * });
 * ```
 */
export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
}

/**
 * MCP request context for tracking and auditing
 */
export interface MCPRequestContext {
  requestId: string;
  sessionId?: string;
  auth?: unknown;
  startTime: number;
}