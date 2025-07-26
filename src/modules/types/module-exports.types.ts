/**
 * Type definitions for strongly typed module exports.
 * @file Module export type definitions.
 * @module modules/types/module-exports
 */

import type {
 Prompt, Resource, Tool
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Resource module exports interface.
 * Modules that provide MCP resources must implement this interface.
 */
export interface IResourceModuleExports {
  listResources: () => Promise<Resource[]>;
  getResource: (uri: string) => Promise<Resource | null>;
}

/**
 * Prompt module exports interface.
 * Modules that provide MCP prompts must implement this interface.
 */
export interface IPromptModuleExports {
  listPrompts: () => Promise<Prompt[]>;
  getPrompt: (name: string) => Promise<Prompt | null>;
}

/**
 * Tool module exports interface.
 * Modules that provide MCP tools must implement this interface.
 */
export interface IToolModuleExports {
  listTools: () => Promise<Tool[]>;
  getTool: (name: string) => Promise<Tool | null>;
  executeTool: (name: string, args: unknown) => Promise<unknown>;
}

/**
 * Combined MCP module exports interface.
 * Modules can implement any combination of these interfaces.
 */
export interface IMCPContentModuleExports {
  resources?: IResourceModuleExports;
  prompts?: IPromptModuleExports;
  tools?: IToolModuleExports;
}

/**
 * Type guard to check if exports include resource functionality.
 * @param exports
 */
export function hasResourceExports(exports: unknown): exports is { resources: IResourceModuleExports } {
  if (!exports || typeof exports !== 'object') {
    return false;
  }

  const obj = exports as Record<string, unknown>;
  if (!obj.resources || typeof obj.resources !== 'object') {
    return false;
  }

  const resources = obj.resources as Record<string, unknown>;
  return (
    typeof resources.listResources === 'function'
    && typeof resources.getResource === 'function'
  );
}

/**
 * Type guard to check if exports include prompt functionality.
 * @param exports
 */
export function hasPromptExports(exports: unknown): exports is { prompts: IPromptModuleExports } {
  if (!exports || typeof exports !== 'object') {
    return false;
  }

  const obj = exports as Record<string, unknown>;
  if (!obj.prompts || typeof obj.prompts !== 'object') {
    return false;
  }

  const prompts = obj.prompts as Record<string, unknown>;
  return (
    typeof prompts.listPrompts === 'function'
    && typeof prompts.getPrompt === 'function'
  );
}

/**
 * Type guard to check if exports include tool functionality.
 * @param exports
 */
export function hasToolExports(exports: unknown): exports is { tools: IToolModuleExports } {
  if (!exports || typeof exports !== 'object') {
    return false;
  }

  const obj = exports as Record<string, unknown>;
  if (!obj.tools || typeof obj.tools !== 'object') {
    return false;
  }

  const tools = obj.tools as Record<string, unknown>;
  return (
    typeof tools.listTools === 'function'
    && typeof tools.getTool === 'function'
    && typeof tools.executeTool === 'function'
  );
}
