/**
 * MCP module - Model Context Protocol integration for managing AI model contexts.
 * @file MCP module entry point.
 * @module modules/core/mcp
 */

import { BaseModule } from '@/modules/core/modules/base/BaseModule';
import { ModulesType } from '@/modules/core/modules/types/manual';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import type {
  Prompt, Resource, Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import { MCPModuleExportsSchema } from '@/modules/core/mcp/types/mcp.service.generated';
import { type ZodSchema } from 'zod';

/**
 * MCP module implementation using BaseModule.
 */
export class MCPModule extends BaseModule<IMCPModuleExports> {
  public readonly name = 'mcp' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Model Context Protocol integration for managing AI model contexts';
  public readonly dependencies = ['logger', 'database', 'modules'] as const;
  private mcpService!: MCPService;

  get exports(): IMCPModuleExports {
    this.ensureInitialized();
    return {
      service: (): MCPService => this.mcpService,
      resources: {
        listResources: async (): Promise<Resource[]> => this.listResources(),
        getResource: async (uri: string): Promise<Resource | null> => this.getResource(uri),
      },
      prompts: {
        listPrompts: async (): Promise<Prompt[]> => this.listPrompts(),
        getPrompt: async (name: string): Promise<Prompt | null> => this.getPrompt(name),
      },
      tools: {
        listTools: async (): Promise<Tool[]> => this.listTools(),
        getTool: async (name: string): Promise<Tool | null> => this.getTool(name),
        executeTool: async (name: string, args: unknown): Promise<unknown> =>
          await this.executeTool(name, args),
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected override getExportsSchema(): ZodSchema {
    return MCPModuleExportsSchema;
  }

  /**
   * Module-specific initialization logic.
   */
  protected async initializeModule(): Promise<void> {
    this.mcpService = MCPService.getInstance();
    await this.mcpService.initialize();
  }

  /**
   * Get the log source for this module.
   */
  protected override getLogSource(): LogSource {
    return LogSource.MCP;
  }

  /**
   * List available resources.
   * @returns Array of available resources.
   */
  private listResources(): Resource[] {
    return [
      {
        uri: 'agent://status',
        name: 'Agent Status',
        description: 'Current status and capabilities of the agent',
        mimeType: 'application/json',
      },
      {
        uri: 'task://list',
        name: 'Task List',
        description: 'List of all tasks',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Get a specific resource.
   * @param uri - The URI of the resource to retrieve.
   * @returns The resource if found, null otherwise.
   */
  private getResource(uri: string): Resource | null {
    const resources = this.listResources();
    return resources.find((resource): boolean => resource.uri === uri) ?? null;
  }

  /**
   * List available prompts.
   * @returns Array of available prompts.
   */
  private listPrompts(): Prompt[] {
    return [];
  }

  /**
   * Get a specific prompt.
   * @param name - The name of the prompt to retrieve.
   * @returns The prompt if found, null otherwise.
   */
  private getPrompt(name: string): Prompt | null {
    const prompts = this.listPrompts();
    return prompts.find((prompt): boolean => prompt.name === name) ?? null;
  }

  /**
   * List available tools.
   * @returns Array of available tools.
   */
  private listTools(): Tool[] {
    return [];
  }

  /**
   * Get a specific tool.
   * @param name - The name of the tool to retrieve.
   * @returns The tool if found, null otherwise.
   */
  private getTool(name: string): Tool | null {
    const tools = this.listTools();
    return tools.find((tool): boolean => tool.name === name) ?? null;
  }

  /**
   * Execute a tool.
   * @param name - The name of the tool to execute.
   * @param args - Arguments for the tool execution.
   * @returns The result of tool execution.
   * @throws Error when tool execution is not implemented.
   */
  private executeTool(name: string, args: unknown): unknown {
    void args;
    throw new Error(`Tool execution not implemented for: ${name}`);
  }
}

/**
 * Factory function for creating the module.
 * @returns A new MCP module instance.
 */
export const createModule = (): MCPModule => {
  return new MCPModule();
};

/**
 * Initialize function for core module pattern.
 * @returns An initialized MCP module instance.
 */
export const initialize = async (): Promise<MCPModule> => {
  const mcpModule = new MCPModule();
  await mcpModule.initialize();
  return mcpModule;
};

/**
 * Export the IMCPModuleExports type for use in other modules.
 */
export type { IMCPModuleExports };