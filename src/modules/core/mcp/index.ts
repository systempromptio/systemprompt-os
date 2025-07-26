/**
 * MCP module - Model Context Protocol integration for managing AI model contexts.
 * @file MCP module entry point.
 * @module modules/core/mcp
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
 Prompt, Resource, Tool
} from '@modelcontextprotocol/sdk/types.js';
import type {
 IPromptModuleExports, IResourceModuleExports, IToolModuleExports
} from '@/modules/types/index';

/**
 * Strongly typed exports interface for MCP module.
 */
export interface IMCPModuleExports {
  readonly service: () => MCPService;
  readonly resources: IResourceModuleExports;
  readonly prompts: IPromptModuleExports;
  readonly tools: IToolModuleExports;
}

/**
 * MCP module implementation.
 */
export class MCPModule implements IModule<IMCPModuleExports> {
  public readonly name = 'mcp';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Model Context Protocol integration for managing AI model contexts';
  public readonly dependencies = ['logger', 'database', 'modules'];
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private mcpService!: MCPService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IMCPModuleExports {
    return {
      service: () => { return this.getService(); },
      resources: {
        listResources: async () => { return await this.listResources(); },
        getResource: async (uri: string) => { return await this.getResource(uri); },
      },
      prompts: {
        listPrompts: async () => { return await this.listPrompts(); },
        getPrompt: async (name: string) => { return await this.getPrompt(name); },
      },
      tools: {
        listTools: async () => { return await this.listTools(); },
        getTool: async (name: string) => { return await this.getTool(name); },
        executeTool: async (name: string, args: unknown) => { return await this.executeTool(name, args); },
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

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MCP, 'MCP module started');
  }

  /**
   * Stop the MCP module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MCP, 'MCP module stopped');
    }
  }

  /**
   * Health check for the MCP module.
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
   */
  getService(): MCPService {
    if (!this.initialized) {
      throw new Error('MCP module not initialized');
    }
    return this.mcpService;
  }

  /**
   * List available resources.
   */
  private async listResources(): Promise<Resource[]> {
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
   * @param uri
   */
  private async getResource(uri: string): Promise<Resource | null> {
    const resources = await this.listResources();
    return resources.find(r => { return r.uri === uri }) || null;
  }

  /**
   * List available prompts.
   */
  private async listPrompts(): Promise<Prompt[]> {
    return [];
  }

  /**
   * Get a specific prompt.
   * @param name
   */
  private async getPrompt(name: string): Promise<Prompt | null> {
    const prompts = await this.listPrompts();
    return prompts.find(p => { return p.name === name }) || null;
  }

  /**
   * List available tools.
   */
  private async listTools(): Promise<Tool[]> {
    return [];
  }

  /**
   * Get a specific tool.
   * @param name
   */
  private async getTool(name: string): Promise<Tool | null> {
    const tools = await this.listTools();
    return tools.find(t => { return t.name === name }) || null;
  }

  /**
   * Execute a tool.
   * @param name
   * @param args
   * @param _args
   */
  private async executeTool(name: string, _args: unknown): Promise<unknown> {
    throw new Error(`Tool execution not implemented for: ${name}`);
  }
}

/**
 * Factory function for creating the module.
 */
export const createModule = (): MCPModule => {
  return new MCPModule();
};

/**
 * Initialize function for core module pattern.
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
export function getMCPModule(): IModule<IMCPModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');

  const moduleLoader = getModuleLoader();
  const mcpModule = moduleLoader.getModule(ModuleName.MCP);

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

  return mcpModule as IModule<IMCPModuleExports>;
}

/**
 * Re-export enums for convenience.
 */
export {
  MCPRoleEnum,
  MCPSessionStatusEnum
} from '@/modules/core/mcp/types/index';
