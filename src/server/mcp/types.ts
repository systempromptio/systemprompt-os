/**
 * @fileoverview TypeScript interfaces and types for MCP server architecture
 * @module server/mcp/types
 */

import type { RequestHandler } from 'express';

/**
 * MCP server types supported by the system
 */
export enum MCPServerType {
  /** Local embedded server that runs as an Express handler */
  LOCAL = 'local',
  /** Remote server accessed via HTTP/HTTPS proxy */
  REMOTE = 'remote'
}

/**
 * Configuration for a remote MCP server
 */
export interface RemoteMCPConfig {
  /** Display name of the server */
  name: string;
  /** Remote server URL */
  url: string;
  /** Authentication configuration */
  auth?: {
    /** Authentication type */
    type: 'bearer' | 'basic' | 'oauth2';
    /** Bearer token for bearer auth */
    token?: string;
    /** Username for basic auth */
    username?: string;
    /** Password for basic auth */
    password?: string;
    /** OAuth2 configuration */
    oauth2?: {
      clientId: string;
      clientSecret: string;
      authorizationUrl: string;
      tokenUrl: string;
      scope?: string;
    };
  };
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}

/**
 * Base interface for all MCP servers
 */
export interface MCPServerBase {
  /** Unique identifier for the server */
  id: string;
  /** Display name of the server */
  name: string;
  /** Server version */
  version: string;
  /** Server type */
  type: MCPServerType;
  /** Server description */
  description?: string;
}

/**
 * Local embedded MCP server
 */
export interface LocalMCPServer extends MCPServerBase {
  type: MCPServerType.LOCAL;
  /** Function that creates an Express request handler */
  createHandler: () => RequestHandler;
  /** Get active session count for this server */
  getActiveSessionCount?: () => number;
  /** Shutdown the server and clean up resources */
  shutdown?: () => void | Promise<void>;
}

/**
 * Remote MCP server accessed via proxy
 */
export interface RemoteMCPServer extends MCPServerBase {
  type: MCPServerType.REMOTE;
  /** Remote server configuration */
  config: RemoteMCPConfig;
}

/**
 * Union type for all MCP server types
 */
export type MCPServer = LocalMCPServer | RemoteMCPServer;

/**
 * MCP server module exports for local servers
 */
export interface MCPServerModule {
  /** Function that creates an MCP handler */
  createMCPHandler: () => RequestHandler;
  /** Optional server configuration */
  CONFIG?: {
    /** Server name */
    SERVERNAME?: string;
    /** Server version */
    SERVERVERSION?: string;
    /** Server description */
    SERVERDESCRIPTION?: string;
  };
}

/**
 * MCP server status information
 */
export interface MCPServerStatus {
  /** Server identifier */
  id: string;
  /** Server display name */
  name: string;
  /** Server operational status */
  status: 'running' | 'stopped' | 'error' | 'unreachable';
  /** Server version */
  version: string;
  /** Server type */
  type: MCPServerType;
  /** Transport protocol */
  transport: 'http' | 'stdio' | 'websocket';
  /** Number of available tools */
  tools?: number;
  /** Number of available resources */
  resources?: number;
  /** Number of available prompts */
  prompts?: number;
  /** Number of active sessions */
  sessions?: number;
  /** Last error message if status is 'error' */
  error?: string;
  /** Server URL for remote servers */
  url?: string;
}

/**
 * Options for loading custom MCP servers
 */
export interface MCPLoaderOptions {
  /** Directory containing custom MCP servers */
  customDir: string;
  /** Whether to load remote server configurations */
  loadRemoteConfigs?: boolean;
  /** Configuration file name for remote servers */
  remoteConfigFile?: string;
}

/**
 * MCP request context with authentication
 */
export interface MCPRequestContext {
  /** Session ID */
  sessionId: string;
  /** Authenticated user information */
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  /** Authentication token if available */
  authToken?: string;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * MCP handler with context
 */
export type MCPHandlerWithContext = (
  req: Request,
  res: Response,
  context: MCPRequestContext
) => Promise<void> | void;

/**
 * MCP session information
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
 * MCP request structure
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * MCP response structure
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
 * Extended MCPServer interface with session management
 */
export interface MCPServerWithSessions extends MCPServerBase {
  sessions: Map<string, MCPSession>;
  createServer?: () => any;
  handleRequest?: (request: MCPRequest) => Promise<MCPResponse>;
  getActiveSessionCount: () => number;
  cleanupOldSessions: () => void;
  shutdown: () => void;
}