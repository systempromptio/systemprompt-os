/**
 * Manual type definitions for MCP module.
 * These types define the module's public API and internal structures.
 */

import type { 
  Tool, 
  Resource, 
  Prompt, 
  CallToolResult,
  Server 
} from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Context (Server) configuration
 */
export interface IMCPContext {
  id: string;
  name: string;
  description?: string;
  version: string;
  server_config: Record<string, any>;
  auth_config?: {
    type: 'bearer' | 'client' | 'none';
    config?: Record<string, any>;
  };
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Tool definition (stored in database)
 */
export interface IMCPTool {
  id: string;
  context_id: string;
  name: string;
  description?: string;
  input_schema: Record<string, any>;
  annotations?: Record<string, any>;
  required_permission?: string;
  required_role?: string;
  handler_type: 'function' | 'http' | 'command';
  handler_config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Resource definition (stored in database)
 */
export interface IMCPResource {
  id: string;
  context_id: string;
  uri: string;
  name: string;
  description?: string;
  mime_type: string;
  annotations?: Record<string, any>;
  content_type: 'static' | 'dynamic';
  content: any;
  required_permission?: string;
  required_role?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Prompt definition (stored in database)
 */
export interface IMCPPrompt {
  id: string;
  context_id: string;
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  annotations?: Record<string, any>;
  template: string;
  required_permission?: string;
  required_role?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Context Permission
 */
export interface IMCPContextPermission {
  id: string;
  context_id: string;
  principal_type: 'user' | 'role';
  principal_id: string;
  permission: 'read' | 'write' | 'execute' | 'manage';
  created_at: Date;
}

/**
 * Create context DTO
 */
export interface ICreateContextDto {
  name: string;
  description?: string;
  version?: string;
  server_config?: Record<string, any>;
  auth_config?: IMCPContext['auth_config'];
}

/**
 * Update context DTO
 */
export interface IUpdateContextDto {
  name?: string;
  description?: string;
  version?: string;
  server_config?: Record<string, any>;
  auth_config?: IMCPContext['auth_config'];
  is_active?: boolean;
}

/**
 * Create tool DTO
 */
export interface ICreateToolDto {
  name: string;
  description?: string;
  input_schema: Record<string, any>;
  annotations?: Record<string, any>;
  required_permission?: string;
  required_role?: string;
  handler_type: 'function' | 'http' | 'command';
  handler_config: Record<string, any>;
}

/**
 * Create resource DTO
 */
export interface ICreateResourceDto {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
  annotations?: Record<string, any>;
  content_type: 'static' | 'dynamic';
  content: any;
  required_permission?: string;
  required_role?: string;
}

/**
 * Create prompt DTO
 */
export interface ICreatePromptDto {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  annotations?: Record<string, any>;
  template: string;
  required_permission?: string;
  required_role?: string;
}

/**
 * MCP Module exports interface
 */
export interface IMCPModuleExports {
  // Context (Server) management
  contexts: {
    create(data: ICreateContextDto): Promise<IMCPContext>;
    update(id: string, data: IUpdateContextDto): Promise<IMCPContext>;
    delete(id: string): Promise<void>;
    get(id: string): Promise<IMCPContext | null>;
    getByName(name: string): Promise<IMCPContext | null>;
    list(filters?: { is_active?: boolean }): Promise<IMCPContext[]>;
  };
  
  // Tools management
  tools: {
    create(contextId: string, tool: ICreateToolDto): Promise<IMCPTool>;
    update(id: string, tool: Partial<ICreateToolDto>): Promise<IMCPTool>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<IMCPTool[]>;
    listAsSDK(contextId: string): Promise<Tool[]>;
  };
  
  // Resources management
  resources: {
    create(contextId: string, resource: ICreateResourceDto): Promise<IMCPResource>;
    update(id: string, resource: Partial<ICreateResourceDto>): Promise<IMCPResource>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<IMCPResource[]>;
    listAsSDK(contextId: string): Promise<Resource[]>;
    read(contextId: string, uri: string): Promise<any>;
  };
  
  // Prompts management
  prompts: {
    create(contextId: string, prompt: ICreatePromptDto): Promise<IMCPPrompt>;
    update(id: string, prompt: Partial<ICreatePromptDto>): Promise<IMCPPrompt>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<IMCPPrompt[]>;
    listAsSDK(contextId: string): Promise<Prompt[]>;
    get(contextId: string, name: string, args?: Record<string, any>): Promise<string>;
  };
  
  // Server creation (using MCP SDK)
  server: {
    create(contextId: string): Promise<any>; // Returns MCP SDK Server
    getOrCreate(contextId: string): Promise<any>; // Returns MCP SDK Server
  };
  
  // Permissions
  permissions: {
    grant(contextId: string, principalType: 'user' | 'role', principalId: string, permission: 'read' | 'write' | 'execute' | 'manage'): Promise<void>;
    revoke(contextId: string, principalType: 'user' | 'role', principalId: string, permission: 'read' | 'write' | 'execute' | 'manage'): Promise<void>;
    check(contextId: string, userId?: string, roleIds?: string[], permission?: 'read' | 'write' | 'execute' | 'manage'): Promise<boolean>;
    list(contextId: string): Promise<IMCPContextPermission[]>;
  };
}