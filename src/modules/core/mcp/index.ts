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
  Prompt, Resource, Tool, CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import { MCPModuleExportsSchema } from '@/modules/core/mcp/types/mcp.service.generated';
import { type ZodSchema } from 'zod';
import type { IToolPermissionMeta } from '@/server/mcp/core/types/tool';

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
    
    // Set up event listeners for MCP tool execution
    this.setupMcpEventListeners();
  }
  
  /**
   * Set up event listeners for MCP tool execution
   */
  private setupMcpEventListeners(): void {
    // Listen for execute-cli tool calls from MCP protocol handler
    this.eventBus.on('mcp.mcp.tool.execute-cli', async (event: any) => {
      try {
        const result = await this.handleExecuteCliTool(event.arguments);
        
        // Send response back
        this.eventBus.emit(`response.${event.requestId}`, {
          data: {
            content: [
              {
                type: 'text',
                text: result.text,
              },
            ],
          },
        });
      } catch (error) {
        this.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
            statusCode: 500,
          },
        });
      }
    });
  }
  
  /**
   * Handle execute-cli tool execution
   */
  private async handleExecuteCliTool(args: any): Promise<CallToolResult> {
    // Import the tool handler
    const { handleExecuteCli } = await import('@/server/mcp/core/handlers/tools/execute-cli');
    
    // Create context for tool execution
    const context = {
      sessionId: 'mcp-http',
      userId: 'mcp-user',
    };
    
    // Execute the tool
    const result = await handleExecuteCli(args, context);
    
    // Return the result directly
    return result;
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
    return [
      {
        name: 'execute-cli',
        description: 'Execute SystemPrompt OS CLI commands',
        inputSchema: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Module name (e.g., database, auth, dev)',
            },
            command: {
              type: 'string',
              description: 'Command name (e.g., status, list, migrate)',
            },
            args: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Additional arguments for the command',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
            },
          },
        },
      },
      {
        name: 'checkstatus',
        description: 'Check system status and health',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
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
   * Get tool metadata for permissions.
   * @param name - The name of the tool.
   * @returns Tool metadata.
   */
  private getToolMetadata(name: string): IToolPermissionMeta {
    // Define metadata for each tool
    const metadata: Record<string, IToolPermissionMeta> = {
      'execute-cli': {
        requiredRole: 'admin',
        requiredPermissions: ['cli.execute'],
      },
      'checkstatus': {
        requiredRole: 'admin',
        requiredPermissions: ['system.status'],
      },
    };
    return metadata[name] || {};
  }

  /**
   * Get a tool with metadata.
   * @param name - The name of the tool to retrieve.
   * @returns The tool with metadata if found, null otherwise.
   */
  private getToolWithMetadata(name: string): { metadata?: IToolPermissionMeta } | null {
    const tool = this.getTool(name);
    if (!tool) return null;
    
    return {
      ...tool,
      metadata: this.getToolMetadata(name),
    };
  }

  /**
   * Execute a tool.
   * @param name - The name of the tool to execute.
   * @param args - Arguments for the tool execution.
   * @returns The result of tool execution.
   * @throws Error when tool execution is not implemented.
   */
  private async executeTool(name: string, _args: unknown): Promise<unknown> {
    // This method is for the standard MCP module interface
    // For now, just throw an error since we use executeToolWithContext
    throw new Error(`Direct tool execution not implemented for: ${name}`);
  }

  /**
   * Execute a tool with context.
   * @param name - The name of the tool to execute.
   * @param args - Arguments for the tool execution.
   * @param context - Execution context with user info.
   * @returns The result of tool execution.
   */
  private async executeToolWithContext(
    name: string, 
    args: Record<string, unknown>,
    context: {
      userId: string;
      userEmail: string;
      sessionId: string;
      requestId: string;
    }
  ): Promise<CallToolResult> {
    // Import tool handlers dynamically to avoid circular dependencies
    const { handleExecuteCli } = await import('@/server/mcp/core/handlers/tools/execute-cli');
    const { handleCheckStatus } = await import('@/server/mcp/core/handlers/tools/check-status');

    switch (name) {
      case 'execute-cli':
        return handleExecuteCli(args, context);
      case 'checkstatus':
        return handleCheckStatus(args, context);
      default:
        throw new Error(`Tool execution not implemented for: ${name}`);
    }
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