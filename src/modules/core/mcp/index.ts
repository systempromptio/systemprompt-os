import { ModulesType } from "@/modules/core/modules/types/database.generated";
/**
 * MCP module - Model Context Protocol integration for managing AI model contexts.
 * @file MCP module entry point.
 * @module modules/core/mcp
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModulesStatus } from "@/modules/core/modules/types/database.generated";
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  Prompt, Resource, Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { IMCPModuleExports as IMCPModuleExportsType } from '@/modules/core/mcp/types/index';

/**
 * MCP module implementation.
 */
export class MCPModule implements IModule<IMCPModuleExportsType> {
  public readonly name = 'mcp';
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Model Context Protocol integration for managing AI model contexts';
  public readonly dependencies = ['logger', 'database', 'modules'];
  public status: ModulesStatus = ModulesStatus.PENDING;
  private mcpService!: MCPService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IMCPModuleExportsType {
    return {
      service: (): MCPService => { return this.getService() },
      resources: {
        listResources: async (): Promise<Resource[]> => { return this.listResources() },
        getResource: async (uri: string): Promise<Resource | null> => { return this.getResource(uri) },
      },
      prompts: {
        listPrompts: async (): Promise<Prompt[]> => { return this.listPrompts() },
        getPrompt: async (name: string): Promise<Prompt | null> => { return this.getPrompt(name) },
      },
      tools: {
        listTools: async (): Promise<Tool[]> => { return this.listTools() },
        getTool: async (name: string): Promise<Tool | null> => { return this.getTool(name) },
        executeTool: async (name: string, args: unknown): Promise<unknown> =>
          { return await this.executeTool(name, args) },
      },
    };
  }

  /**
   * Initialize the MCP module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('MCP module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.mcpService = MCPService.getInstance();

    try {
      await this.mcpService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.MCP, 'MCP module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize MCP module: ${errorMessage}`);
    }
  }

  /**
   * Start the MCP module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('MCP module not initialized');
    }

    if (this.started) {
      throw new Error('MCP module already started');
    }

    this.status = ModulesStatus.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MCP, 'MCP module started');
  }

  /**
   * Stop the MCP module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModulesStatus.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MCP, 'MCP module stopped');
    }
  }

  /**
   * Health check for the MCP module.
   * @returns Health status object.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'MCP module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'MCP module not started'
      };
    }
    return {
      healthy: true,
      message: 'MCP module is healthy'
    };
  }

  /**
   * Get the MCP service.
   * @returns The MCP service instance.
   * @throws Error if module not initialized.
   */
  getService(): MCPService {
    if (!this.initialized) {
      throw new Error('MCP module not initialized');
    }
    return this.mcpService;
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
    return resources.find((resource): boolean => { return resource.uri === uri }) ?? null;
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
    return prompts.find((prompt): boolean => { return prompt.name === name }) ?? null;
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
    return tools.find((tool): boolean => { return tool.name === name }) ?? null;
  }

  /**
   * Execute a tool.
   * @param name - The name of the tool to execute.
   * @param args - Arguments for the tool execution.
   * @returns The result of tool execution.
   * @throws Error when tool execution is not implemented.
   */
  private executeTool(name: string, args: unknown): unknown {
    void args
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
 * Gets the MCP module with type safety and validation.
 * @returns The MCP module with guaranteed typed exports.
 * @throws {Error} If MCP module is not available or missing required exports.
 */
export function getMCPModule(): IModule<IMCPModuleExportsType> {
  const { getModuleRegistry } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');

  const registry = getModuleRegistry();
  const mcpModule = registry.get(ModuleName.MCP);

  if (!mcpModule.exports?.service || typeof mcpModule.exports.service !== 'function') {
    throw new Error('MCP module missing required service export');
  }

  if (!mcpModule.exports?.resources || typeof mcpModule.exports.resources !== 'object') {
    throw new Error('MCP module missing required resources export');
  }

  if (!mcpModule.exports?.prompts || typeof mcpModule.exports.prompts !== 'object') {
    throw new Error('MCP module missing required prompts export');
  }

  if (!mcpModule.exports?.tools || typeof mcpModule.exports.tools !== 'object') {
    throw new Error('MCP module missing required tools export');
  }

  return mcpModule as IModule<IMCPModuleExportsType>;
}

/**
 * Export the IMCPModuleExports type for use in other modules.
 */
export type { IMCPModuleExportsType as IMCPModuleExports };

// No type reexports - use autogenerated types directly from database.generated.ts
