/**
 * @fileoverview Type definitions for the tools module
 * @module tools/types
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool scope determines where the tool can be executed
 */
export type ToolScope = 'remote' | 'local' | 'all';

/**
 * Database representation of a tool
 */
export interface DBTool {
  id: number;
  name: string;
  description: string;
  input_schema: string;
  handler_path: string;
  module_name: string;
  scope: ToolScope;
  enabled: number;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tool metadata for additional information
 */
export interface ToolMetadata {
  version?: string;
  author?: string;
  tags?: string[];
  permissions?: string[];
  [key: string]: any;
}

/**
 * Extended tool type that includes our custom fields
 */
export interface ExtendedTool extends Tool {
  handlerPath: string;
  moduleName: string;
  scope: ToolScope;
  enabled: boolean;
  metadata?: ToolMetadata;
}

/**
 * Tool handler function signature
 */
export interface ToolHandler {
  (params: any, context?: ToolContext): Promise<any>;
}

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  moduleName: string;
  userId?: string;
  sessionId?: string;
  logger?: Console;
  [key: string]: any;
}

/**
 * Tool definition as discovered from modules
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: ToolHandler | string;
  scope: ToolScope;
  metadata?: ToolMetadata;
}

/**
 * Result of tool discovery
 */
export interface DiscoveredTool {
  definition: ToolDefinition;
  moduleName: string;
  filePath: string;
}

/**
 * Tool filter options
 */
export interface ToolFilterOptions {
  scope?: ToolScope;
  enabled?: boolean;
  moduleName?: string;
}

/**
 * Tool update data
 */
export interface UpdateToolData {
  description?: string;
  input_schema?: any;
  scope?: ToolScope;
  enabled?: boolean;
  metadata?: ToolMetadata;
}