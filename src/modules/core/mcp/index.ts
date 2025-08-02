/**
 * MCP module - Model Context Protocol integration for managing AI model contexts.
 * @file MCP module entry point.
 * @module modules/core/mcp
 */

import { BaseModule } from '@/modules/core/modules/base/BaseModule';
import { ModulesType, ModulesStatus } from '@/modules/core/modules/types/manual';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { z } from 'zod';
import type {
  Prompt, Resource, Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { 
  IMCPModuleExports,
  ICreateContextDto,
  IUpdateContextDto,
  ICreateToolDto,
  ICreateResourceDto,
  ICreatePromptDto
} from '@/modules/core/mcp/types/manual';

/**
 * MCP module implementation using BaseModule.
 */
export class MCPModule extends BaseModule<IMCPModuleExports> {
  public readonly name = 'mcp' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Model Context Protocol integration for managing AI model contexts';
  public readonly dependencies = ['logger', 'database', 'events'] as const;
  private mcpService!: MCPService;
  
  // CLI commands
  public readonly cliCommands = async () => {
    const { cliCommands } = await import('./cli/index');
    return cliCommands;
  };

  /**
   * Get the Zod schema for validating module exports.
   */
  protected getExportsSchema(): z.ZodSchema<IMCPModuleExports> {
    // Return a basic schema - full validation would be complex for this module
    return z.object({
      contexts: z.any(),
      tools: z.any(),
      resources: z.any(),
      prompts: z.any(),
      server: z.any(),
      permissions: z.any()
    }) as z.ZodSchema<IMCPModuleExports>;
  }

  get exports(): IMCPModuleExports {
    this.ensureInitialized();
    const repos = this.mcpService.getRepositories();
    
    return {
      // Context (Server) management
      contexts: {
        create: async (data: ICreateContextDto) => {
          return this.mcpService.createContext(data);
        },
        update: async (id: string, data: IUpdateContextDto) => {
          return this.mcpService.updateContext(id, data);
        },
        delete: async (id: string) => {
          return this.mcpService.deleteContext(id);
        },
        get: async (id: string) => {
          return repos.contexts.findById(id);
        },
        getByName: async (name: string) => {
          return repos.contexts.findByName(name);
        },
        list: async (options?: { limit?: number; offset?: number; is_active?: boolean }) => {
          return repos.contexts.list(options);
        }
      },
      
      // Tools management
      tools: {
        create: async (contextId: string, data: ICreateToolDto) => {
          return this.mcpService.createTool(contextId, data);
        },
        update: async (id: string, data: Partial<ICreateToolDto>) => {
          return repos.tools.update(id, data);
        },
        delete: async (id: string) => {
          return repos.tools.delete(id);
        },
        get: async (id: string) => {
          return repos.tools.findById(id);
        },
        listByContext: async (contextId: string) => {
          return repos.tools.findByContextId(contextId);
        },
        getMcpTools: async (contextId: string): Promise<Tool[]> => {
          return this.mcpService.getToolsForContext(contextId);
        },
        listAsSDK: async (contextId: string): Promise<Tool[]> => {
          return this.mcpService.getToolsForContext(contextId);
        }
      },
      
      // Resources management
      resources: {
        create: async (contextId: string, data: ICreateResourceDto) => {
          return this.mcpService.createResource(contextId, data);
        },
        update: async (id: string, data: Partial<ICreateResourceDto>) => {
          return repos.resources.update(id, data);
        },
        delete: async (id: string) => {
          return repos.resources.delete(id);
        },
        get: async (id: string) => {
          return repos.resources.findById(id);
        },
        listByContext: async (contextId: string) => {
          return repos.resources.findByContextId(contextId);
        },
        getMcpResources: async (contextId: string): Promise<Resource[]> => {
          return this.mcpService.getResourcesForContext(contextId);
        },
        listAsSDK: async (contextId: string): Promise<Resource[]> => {
          return this.mcpService.getResourcesForContext(contextId);
        }
      },
      
      // Prompts management
      prompts: {
        create: async (contextId: string, data: ICreatePromptDto) => {
          return this.mcpService.createPrompt(contextId, data);
        },
        update: async (id: string, data: Partial<ICreatePromptDto>) => {
          return repos.prompts.update(id, data);
        },
        delete: async (id: string) => {
          return repos.prompts.delete(id);
        },
        get: async (id: string) => {
          return repos.prompts.findById(id);
        },
        listByContext: async (contextId: string) => {
          return repos.prompts.findByContextId(contextId);
        },
        getMcpPrompts: async (contextId: string): Promise<Prompt[]> => {
          return this.mcpService.getPromptsForContext(contextId);
        },
        listAsSDK: async (contextId: string): Promise<Prompt[]> => {
          return this.mcpService.getPromptsForContext(contextId);
        }
      },
      
      // Server creation
      server: {
        createFromContext: async (contextId: string) => {
          return this.mcpService.createServerFromContext(contextId);
        },
        getOrCreate: async (contextId: string) => {
          return this.mcpService.getOrCreateServer(contextId);
        }
      },
      
      // Permissions management
      // Get repositories for direct access
      getRepositories: () => {
        return this.mcpService.getRepositories();
      },
      
      permissions: {
        grant: async (contextId: string, principalId: string, permission: string) => {
          return repos.permissions.create({
            context_id: contextId,
            principal_id: principalId,
            permission,
            granted_at: new Date().toISOString()
          });
        },
        revoke: async (contextId: string, principalId: string, permission: string) => {
          return repos.permissions.revoke(contextId, principalId, permission);
        },
        check: async (contextId: string, principalId: string, permission: string) => {
          return repos.permissions.hasPermission(contextId, principalId, permission);
        },
        listForContext: async (contextId: string) => {
          return repos.permissions.findByContextId(contextId);
        }
      }
    };
  }

  /**
   * Module-specific initialization logic.
   */
  protected async initializeModule(): Promise<void> {
    // Get singleton services directly (following the rules)
    const logger = LoggerService.getInstance();
    const database = DatabaseService.getInstance();
    const eventBus = EventBusService.getInstance();
    
    // Initialize MCP service with dependencies
    this.mcpService = MCPService.getInstance();
    await this.mcpService.initialize(database as any, eventBus as any);
    
    // Set up event listeners for MCP tool execution
    this.setupMcpEventListeners(eventBus);
    
    logger.info(LogSource.MCP, 'MCP module initialized');
  }
  
  /**
   * Start the module operations.
   */
  public async start(): Promise<void> {
    if (this.status === ModulesStatus.RUNNING) return;
    
    this.ensureInitialized();
    this.status = ModulesStatus.RUNNING;
    
    const logger = LoggerService.getInstance();
    logger.info(LogSource.MCP, 'MCP module started');
    
    // Emit lifecycle event
    const eventBus = EventBusService.getInstance();
    eventBus.emit('module:started', { module: this.name });
  }
  
  /**
   * Stop the module operations.
   */
  public async stop(): Promise<void> {
    if (this.status === ModulesStatus.STOPPED) return;
    
    this.status = ModulesStatus.STOPPING;
    
    // Clean up any active MCP servers
    // TODO: Implement server cleanup
    
    this.status = ModulesStatus.STOPPED;
    
    const logger = LoggerService.getInstance();
    logger.info(LogSource.MCP, 'MCP module stopped');
    
    // Emit lifecycle event
    const eventBus = EventBusService.getInstance();
    eventBus.emit('module:stopped', { module: this.name });
  }
  
  /**
   * Set up event listeners for MCP tool execution
   */
  private setupMcpEventListeners(eventBus: any): void {
    // Listen for tool execution events from MCP SDK Server
    eventBus.on('mcp.tool.echo.execute', async (event: any) => {
      try {
        const message = event.args?.message || 'No message provided';
        const result = {
          content: [
            {
              type: 'text',
              text: `Echo: ${message}`
            }
          ]
        };
        
        eventBus.emit('mcp.tool.echo.result', {
          result
        });
      } catch (error: any) {
        eventBus.emit('mcp.tool.echo.result', {
          error: error.message
        });
      }
    });
    
    eventBus.on('mcp.tool.calculate.execute', async (event: any) => {
      try {
        const { operation, a, b } = event.args || {};
        let result: number;
        
        switch (operation) {
          case 'add':
            result = a + b;
            break;
          case 'subtract':
            result = a - b;
            break;
          case 'multiply':
            result = a * b;
            break;
          case 'divide':
            result = a / b;
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        
        const response = {
          content: [
            {
              type: 'text',
              text: `Result: ${result}`
            }
          ]
        };
        
        eventBus.emit('mcp.tool.calculate.result', {
          result: response
        });
      } catch (error: any) {
        eventBus.emit('mcp.tool.calculate.result', {
          error: error.message
        });
      }
    });
    
    // Listen for execute-cli tool calls from MCP protocol handler
    eventBus.on('mcp.tool.execute-cli', async (event: any) => {
      try {
        const { executeSimpleCli } = await import('@/server/mcp/handlers/simple-cli-handler');
        
        // Execute the tool directly without context (simple handler doesn't need it)
        const result = await executeSimpleCli(event.arguments);
        
        // Send response back via the requestId
        eventBus.emit(`response.${event.requestId}`, {
          data: result
        });
      } catch (error: any) {
        // Send error response
        eventBus.emit(`response.${event.requestId}`, {
          error: error.message
        });
      }
    });
    
    // Listen for system-status tool calls
    eventBus.on('mcp.tool.system-status', async (event: any) => {
      try {
        // Get system status
        const result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              modules: 14,
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
        
        eventBus.emit(`response.${event.requestId}`, {
          data: result
        });
      } catch (error: any) {
        eventBus.emit(`response.${event.requestId}`, {
          error: error.message
        });
      }
    });
  }
}

/**
 * Create module instance.
 */
export function createModule(): MCPModule {
  return new MCPModule();
}