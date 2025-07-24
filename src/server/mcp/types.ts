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
export interface RemoteMCPConfig {
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
export interface MCPServerBase {
    id: string;
    name: string;
    version: string;
    type: MCPServerType;
    description?: string;
}

/**
 * Local embedded MCP server.
 */
export interface LocalMCPServer extends MCPServerBase {
  type: MCPServerType.LOCAL;
    createHandler: () => RequestHandler;
    getActiveSessionCount?: () => number;
    shutdown?: () => void | Promise<void>;
}

/**
 * Remote MCP server accessed via proxy.
 */
export interface RemoteMCPServer extends MCPServerBase {
  type: MCPServerType.REMOTE;
    config: RemoteMCPConfig;
}

/**
 * Union type for all MCP server types.
 */
export type MCPServer = LocalMCPServer | RemoteMCPServer;

/**
 * MCP server module exports for local servers.
 */
export interface MCPServerModule {
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
export interface MCPServerStatus {
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
export interface MCPLoaderOptions {
    customDir: string;
    loadRemoteConfigs?: boolean;
    remoteConfigFile?: string;
}

/**
 * MCP request context with authentication.
 */
export interface MCPRequestContext {
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
  context: MCPRequestContext
) => Promise<void> | void;

/**
 * MCP session information.
 */
export interface MCPSession {
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
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * MCP response structure.
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Extended MCPServer interface with session management.
 */
export interface MCPServerWithSessions extends MCPServerBase {
  sessions: Map<string, MCPSession>;
  createServer?: () => any;
  handleRequest?: (request: MCPRequest) => Promise<MCPResponse>;
  getActiveSessionCount: () => number;
  cleanupOldSessions: () => void;
  shutdown: () => void;
}
