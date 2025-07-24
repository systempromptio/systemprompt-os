/**
 * @file TypeScript interfaces and types for MCP server architecture.
 * @module server/mcp/types
 */

import type { RequestHandler } from 'express';

/**
 * MCP server types supported by the system.
 */
export enum MCPServerType {
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
export interface IRemoteMCPConfig {
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
export interface IMCPServerBase {
    id: string;
    name: string;
    version: string;
    type: MCPServerType;
    description?: string;
}

/**
 * Local embedded MCP server.
 */
export interface ILocalMCPServer extends IMCPServerBase {
  type: MCPServerType.LOCAL;
    createHandler: () => RequestHandler;
    getActiveSessionCount?: () => number;
    shutdown?: () => void | Promise<void>;
}

/**
 * Remote MCP server accessed via proxy.
 */
export interface IRemoteMCPServer extends IMCPServerBase {
  type: MCPServerType.REMOTE;
    config: IRemoteMCPConfig;
}

/**
 * Union type for all MCP server types.
 */
export type MCPServer = ILocalMCPServer | IRemoteMCPServer;

/**
 * MCP server module exports for local servers.
 */
export interface IMCPServerModule {
    createMCPHandler: () => RequestHandler;
    CONFIG?: {
        SERVERNAME?: string;
        SERVERVERSION?: string;
        SERVERDESCRIPTION?: string;
  };
}

/**
 * MCP server status information.
 */
export interface IMCPServerStatus {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'error' | 'unreachable';
    version: string;
    type: MCPServerType;
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
export interface IMCPLoaderOptions {
    customDir: string;
    loadRemoteConfigs?: boolean;
    remoteConfigFile?: string;
}

/**
 * MCP request context with authentication.
 */
export interface IMCPRequestContext {
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
export type MCPHandlerWithContext = (
  req: Request,
  res: Response,
  context: IMCPRequestContext
) => Promise<void> | void;

/**
 * MCP session information.
 */
export interface IMCPSession {
  id: string;
  clientInfo: {
    name: string;
    version: string;
  };
  protocolVersion: string;
  capabilities: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * MCP request structure.
 */
export interface IMCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * MCP response structure.
 */
export interface IMCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Extended MCPServer interface with session management.
 */
export interface IMCPServerWithSessions extends IMCPServerBase {
  sessions: Map<string, IMCPSession>;
  createServer?: () => any;
  handleRequest?: (request: IMCPRequest) => Promise<IMCPResponse>;
  getActiveSessionCount: () => number;
  cleanupOldSessions: () => void;
  shutdown: () => void;
}
