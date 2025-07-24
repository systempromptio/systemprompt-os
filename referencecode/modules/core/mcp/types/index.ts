/**
 * @fileoverview MCP module type definitions
 * @module modules/core/mcp/types
 */

import type { Logger } from '../../../types.js';

export interface MCPConfig {
  servers: {
    local: {
      enabled: boolean;
      stdio: boolean;
    };
    remote: {
      enabled: boolean;
      port: number;
      host: string;
    };
  };
  discovery: {
    scanIntervalMs: number;
    directories: string[];
  };
  security: {
    requireAuth: boolean;
    defaultPermissions: string[];
  };
  cache: {
    ttlSeconds: number;
    maxEntries: number;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: string | ((args: any, context: MCPContext) => Promise<any>);
  metadata?: {
    category?: string;
    requiresAuth?: boolean;
    permissions?: string[];
    rateLimit?: {
      requests: number;
      windowMs: number;
    };
  };
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  metadata?: {
    size?: number;
    lastModified?: Date;
    tags?: string[];
  };
}

export interface MCPContext {
  userId?: string;
  sessionId?: string;
  permissions?: string[];
  logger: Logger;
  metadata?: Record<string, any>;
}

export interface MCPCapabilities {
  tools?: boolean;
  prompts?: boolean;
  resources?: boolean;
  resourceTemplates?: boolean;
  resourceSubscriptions?: boolean;
  experimental?: Record<string, boolean>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: MCPCapabilities;
}

export interface MCPRegistry {
  tools: Map<string, MCPTool>;
  prompts: Map<string, MCPPrompt>;
  resources: Map<string, MCPResource>;
}

export interface MCPModule {
  id: string;
  name: string;
  version: string;
  tools?: MCPTool[];
  prompts?: MCPPrompt[];
  resources?: MCPResource[];
  metadata?: {
    author?: string;
    description?: string;
    dependencies?: string[];
  };
}

export interface MCPDiscoveryResult {
  modules: MCPModule[];
  errors: Array<{
    module: string;
    error: string;
  }>;
  stats: {
    totalModules: number;
    totalTools: number;
    totalPrompts: number;
    totalResources: number;
    scanTimeMs: number;
  };
}

export interface MCPExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTimeMs: number;
    cached?: boolean;
  };
}

export interface MCPToolExecution {
  toolName: string;
  arguments: any;
  context: MCPContext;
  startTime: Date;
  endTime?: Date;
  result?: MCPExecutionResult;
  error?: Error;
}

export interface MCPPromptExecution {
  promptName: string;
  arguments: Record<string, any>;
  context: MCPContext;
  result: string;
  metadata?: {
    model?: string;
    tokenCount?: number;
  };
}

export interface MCPResourceAccess {
  uri: string;
  context: MCPContext;
  operation: 'read' | 'write' | 'subscribe' | 'unsubscribe';
  timestamp: Date;
  success: boolean;
}

export interface MCPStats {
  tools: {
    total: number;
    byCategory: Record<string, number>;
    executions: {
      total: number;
      successful: number;
      failed: number;
      averageTimeMs: number;
    };
  };
  prompts: {
    total: number;
    byCategory: Record<string, number>;
    executions: number;
  };
  resources: {
    total: number;
    byType: Record<string, number>;
    accesses: number;
  };
  uptime: number;
  lastScan: Date;
}

export interface MCPError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
}

export type MCPEventType = 
  | 'tool:executed'
  | 'prompt:executed'
  | 'resource:accessed'
  | 'module:loaded'
  | 'module:unloaded'
  | 'discovery:started'
  | 'discovery:completed'
  | 'error:occurred';

export interface MCPEvent {
  type: MCPEventType;
  timestamp: Date;
  data: unknown;
  context?: MCPContext;
}

export interface MCPEventHandler {
  (event: MCPEvent): void | Promise<void>;
}

/**
 * Database row types for MCP data
 */
export interface MCPPromptRow {
  name: string;
  description: string;
  arguments: string;
  metadata: string;
}

export interface MCPPromptDetailRow extends MCPPromptRow {
  messages: string;
}

export interface MCPResourceRow {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  size: number;
  metadata: string;
}

/**
 * MCP Service interface
 */
export interface IMCPService {
  startServers(): Promise<void>;
  stopServers(): Promise<void>;
  listTools(context?: MCPContext): Promise<any[]>;
  executeTool(name: string, args: any, context?: MCPContext): Promise<MCPExecutionResult>;
  listPrompts(context?: MCPContext): Promise<any[]>;
  getPrompt(name: string, args?: Record<string, any>, context?: MCPContext): Promise<any>;
  listResources(context?: MCPContext): Promise<any[]>;
  readResource(uri: string, context?: MCPContext): Promise<any>;
}

import { Token } from 'typedi';

/**
 * Dependency injection token for MCP service
 */
export const MCP_TOKEN = new Token<IMCPService>('core.mcp');