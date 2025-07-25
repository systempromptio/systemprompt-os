/**
 * Type definitions for MCP server management and configuration.
 * @file TypeScript interfaces and types for MCP server architecture.
 * @module server/types/mcp-server
 */

import type { RequestHandler } from 'express';

/**
 * MCP server types supported by the system.
 */
export const enum McpServerTypeEnum {
  /**
   * Local embedded server that runs as an Express handler.
   */
  LOCAL = 'local',
  /**
   * Remote server accessed via HTTP/HTTPS proxy.
   */
  REMOTE = 'remote'
}

/**
 * Configuration for a remote MCP server.
 */
export interface IRemoteMcpConfig {
    name: string;
    url: string;
    auth?: {
        type: 'bearer' | 'basic' | 'oauth2';
        token?: string;
        username?: string;
        password?: string;
        oauth2?: {
      clientId: string;
      clientSecret: string;
      authorizationUrl: string;
      tokenUrl: string;
      scope?: string;
    };
  };
    timeout?: number;
    headers?: Record<string, string>;
}

/**
 * Base interface for all MCP servers.
 */
export interface IMcpServerBase {
    id: string;
    name: string;
    version: string;
    type: McpServerTypeEnum;
    description?: string;
}

/**
 * Local embedded MCP server.
 */
export interface ILocalMcpServer extends IMcpServerBase {
  type: McpServerTypeEnum.LOCAL;
    createHandler: () => RequestHandler;
    getActiveSessionCount?: () => number;
    shutdown?: () => void | Promise<void>;
}

/**
 * Remote MCP server accessed via proxy.
 */
export interface IRemoteMcpServer extends IMcpServerBase {
  type: McpServerTypeEnum.REMOTE;
    config: IRemoteMcpConfig;
}

/**
 * Union type for all MCP server types.
 */
export type McpServer = ILocalMcpServer | IRemoteMcpServer;

/**
 * MCP server module exports for local servers.
 */
export interface IMcpServerModule {
    createMcpHandler: () => RequestHandler;
    config?: {
        serverName?: string;
        serverVersion?: string;
        serverDescription?: string;
  };
}

/**
 * MCP server status information.
 */
export interface IMcpServerStatus {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'error' | 'unreachable';
    version: string;
    type: McpServerTypeEnum;
    transport: 'http' | 'stdio' | 'websocket';
    tools?: number;
    resources?: number;
    prompts?: number;
    sessions?: number;
    error?: string;
    url?: string;
}

/**
 * Options for loading custom MCP servers.
 */
export interface IMcpLoaderOptions {
    customDir: string;
    loadRemoteConfigs?: boolean;
    remoteConfigFile?: string;
}

/**
 * MCP request context with authentication.
 */
export interface IMcpRequestContext {
    sessionId: string;
    user?: {
    id: string;
    username: string;
    email?: string;
  };
    authToken?: string;
    timestamp: Date;
}

/**
 * MCP handler with context.
 */
export type McpHandlerWithContext = (
  req: Request,
  res: Response,
  context: IMcpRequestContext
) => Promise<void> | void;

/**
 * MCP session information.
 */
export interface IMcpSession {
  id: string;
  clientInfo: {
    name: string;
    version: string;
  };
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * MCP request structure.
 */
export interface IMcpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * MCP response structure.
 */
export interface IMcpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    payload?: unknown;
  };
}

/**
 * Extended MCPServer interface with session management.
 */
export interface IMcpServerWithSessions extends IMcpServerBase {
  sessions: Map<string, IMcpSession>;
  createServer?: () => unknown;
  handleRequest?: (request: IMcpRequest) => Promise<IMcpResponse>;
  getActiveSessionCount: () => number;
  cleanupOldSessions: () => void;
  shutdown: () => void;
}
