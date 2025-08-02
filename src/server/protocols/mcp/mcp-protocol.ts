/**
 * MCP Protocol Handler V2.
 * Handles MCP (Model Context Protocol) requests by registering endpoints with HTTP handler.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IProtocolHandler, IServerCore, ProtocolHealth, ServerStatus
} from '../../core/types/server.types';
import { ServerEvents } from '../../core/types/events.types';
import type { McpContext, McpSession } from './types/mcp.types';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { DirectSDKHandler } from './direct-sdk-handler';

export class McpProtocolHandlerV2 implements IProtocolHandler {
  public readonly name = 'mcp';
  private server?: IServerCore;
  private status: ServerStatus = 'initialized';
  private readonly contexts: Map<string, McpContext> = new Map();
  private readonly sessions: Map<string, McpSession> = new Map();
  private mcpModule?: IMCPModuleExports;
  private mcpServers: Map<string, Server> = new Map();
  private streamableHandler?: DirectSDKHandler;

  async initialize(server: IServerCore): Promise<boolean> {
    this.server = server;
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Load MCP module
    try {
      const registry = getModuleRegistry();
      if (registry) {
        const mcpModuleInstance = await registry.get('mcp');
        if (mcpModuleInstance) {
          this.mcpModule = mcpModuleInstance.exports as IMCPModuleExports;
          // Register MCP module as a service so StreamableHTTPHandler can access it
          server.registerService('mcp-module', this.mcpModule);
          await this.loadContextsFromModule();
        }
      }
    } catch (error) {
      console.error('Failed to load MCP module:', error);
      // Fall back to default context if module not available
      this.registerDefaultContext();
    }
    
    // Register CLI tools context if not loaded from module
    if (!this.contexts.has('cli')) {
      this.registerCliContext();
    }
    
    // Initialize Direct SDK handler
    this.streamableHandler = new DirectSDKHandler(server, this.contexts);
    
    // Register MCP endpoints with HTTP handler via events during initialization
    server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'mcp-protocol',
      endpoints: [
        {
          protocol: 'http',
          method: 'all', // Support GET for SSE, POST for messages, DELETE for session termination
          path: '/api/mcp',
          handler: 'mcp.streamable',
          auth: { required: false }
        },
        {
          protocol: 'http',
          method: 'GET', 
          path: '/api/mcp/contexts',
          handler: 'mcp.contexts',
          auth: { required: false }
        }
      ]
    });
    
    // Set up handlers
    server.eventBus.on('mcp.streamable', async (event) => {
      // For streamable HTTP, we need to pass the raw request/response objects
      // This is a special case where we need direct access to the Express req/res
      const httpHandler = server.getService('http-handler');
      if (httpHandler && this.streamableHandler) {
        // Get the raw Express request and response from the event
        const req = event.rawRequest;
        const res = event.rawResponse;
        
        if (req && res) {
          await this.streamableHandler.handleStreamableRequest(req, res);
        } else {
          // Fallback to old request handler for backwards compatibility
          await this.handleMcpRequest(event);
        }
      } else {
        await this.handleMcpRequest(event);
      }
    });
    
    server.eventBus.on('mcp.request', async (event) => {
      await this.handleMcpRequest(event);
    });
    
    server.eventBus.on('mcp.contexts', async (event) => {
      const contexts = await Promise.all(Array.from(this.contexts.entries()).map(async ([name, ctx]) => {
        // For MCP module contexts, get additional info from database
        let description = ctx.metadata?.description;
        if (ctx.moduleId === 'mcp' && this.mcpModule) {
          try {
            const dbContext = await this.mcpModule.contexts.get(ctx.context);
            if (dbContext) {
              description = dbContext.description;
            }
          } catch (error) {
            // Ignore errors
          }
        }
        
        return {
          name,
          metadata: {
            ...ctx.metadata,
            description
          },
          capabilities: {
            tools: ctx.capabilities.tools?.length || 0,
            resources: ctx.capabilities.resources?.length || 0,
            prompts: ctx.capabilities.prompts?.length || 0
          }
        };
      }));
      
      server.eventBus.emit(`response.${event.requestId}`, {
        data: { contexts }
      });
    });

    return true;
  }
  
  private async loadContextsFromModule(): Promise<void> {
    if (!this.mcpModule) return;
    
    try {
      // Load all active contexts from the database
      const contexts = await this.mcpModule.contexts.list({ is_active: true });
      
      for (const ctx of contexts) {
        // Create or get MCP SDK server for this context
        const server = await this.mcpModule.server.getOrCreate(ctx.id);
        this.mcpServers.set(ctx.id, server);
        
        // Load capabilities for the context
        const [tools, resources, prompts] = await Promise.all([
          this.mcpModule.tools.listAsSDK(ctx.id),
          this.mcpModule.resources.listAsSDK(ctx.id),
          this.mcpModule.prompts.listAsSDK(ctx.id)
        ]);
        
        // Register context
        this.contexts.set(ctx.name, {
          moduleId: 'mcp',
          context: ctx.id,
          capabilities: {
            tools,
            resources,
            prompts
          },
          metadata: ctx.server_config || {
            name: ctx.name,
            description: ctx.description,
            version: ctx.version
          },
          auth: ctx.auth_config
        });
      }
    } catch (error) {
      console.error('Failed to load contexts from MCP module:', error);
    }
  }
  
  private registerDefaultContext(): void {
    this.contexts.set('default', {
      moduleId: 'system',
      context: 'default',
      capabilities: {
        tools: [{
          name: 'system-info',
          description: 'Get system information'
        }]
      },
      metadata: {
        name: 'Default MCP Context',
        version: '1.0.0'
      }
    });
  }
  
  private registerCliContext(): void {
    // Register the CLI tools context
    this.contexts.set('cli', {
      moduleId: 'mcp',
      context: 'cli',
      capabilities: {
        tools: [
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
        ],
      },
      metadata: {
        name: 'SystemPrompt CLI Tools',
        description: 'Execute SystemPrompt OS CLI commands via MCP',
        version: '1.0.0',
      },
    });
  }

  async start(): Promise<void> {
    this.status = 'running';
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.sessions.clear();
  }

  getStatus(): ServerStatus {
    return this.status;
  }

  async getHealth(): Promise<ProtocolHealth> {
    return {
      healthy: this.status === 'running',
      details: {
        contexts: this.contexts.size,
        sessions: this.sessions.size
      }
    };
  }

  getRegisteredContexts(): string[] {
    return Array.from(this.contexts.keys());
  }

  private setupEventHandlers(): void {
    if (!this.server) return;

    // Register MCP context
    this.server.eventBus.on(ServerEvents.REGISTER_MCP_CONTEXT, (event) => {
      const { moduleId, context, capabilities, metadata, auth } = event;
      
      this.contexts.set(context, {
        moduleId,
        context,
        capabilities,
        metadata,
        auth
      });
    });

    // Register MCP tools for a context
    this.server.eventBus.on(ServerEvents.REGISTER_MCP_TOOLS, (event) => {
      const { moduleId, tools } = event;
      const context = this.contexts.get(moduleId) || {
        moduleId,
        context: moduleId,
        capabilities: { tools: [] },
        metadata: { name: moduleId, version: '1.0.0' }
      };

      context.capabilities.tools = [...context.capabilities.tools || [], ...tools];
      this.contexts.set(moduleId, context);
    });
  }

  private async handleMcpRequest(event: any): Promise<void> {
    const contextName = event.headers['x-mcp-context'] || 'default';
    const sessionId = event.headers['x-session-id'] || uuidv4();
    
    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        context: contextName,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: {}
      };
      this.sessions.set(sessionId, session);
    }
    session.lastActivity = new Date();

    // Get context
    const context = this.contexts.get(contextName);
    if (!context) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        error: {
          code: 'UNKNOWN_CONTEXT',
          message: `Context '${contextName}' not found`,
          statusCode: 400
        }
      });
      return;
    }

    // Check authentication if required
    if (context.auth?.required && !event.auth?.authenticated) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for this context',
          statusCode: 401
        }
      });
      return;
    }

    const { method, params } = event.body;

    try {
      switch (method) {
        case 'initialize':
          await this.handleInitialize(event, context);
          break;
        case 'list_tools':
          await this.handleListTools(event, context);
          break;
        case 'call_tool':
          await this.handleCallTool(event, context, params);
          break;
        case 'list_resources':
          await this.handleListResources(event, context);
          break;
        case 'read_resource':
          await this.handleReadResource(event, context, params);
          break;
        case 'list_prompts':
          await this.handleListPrompts(event, context);
          break;
        case 'get_prompt':
          await this.handleGetPrompt(event, context, params);
          break;
        default:
          this.server!.eventBus.emit(`response.${event.requestId}`, {
            error: {
              code: 'INVALID_METHOD',
              message: `Unknown method: ${method}`,
              statusCode: 400
            }
          });
      }
    } catch (error) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500
        }
      });
    }
  }

  private async handleInitialize(event: any, context: McpContext): Promise<void> {
    this.server!.eventBus.emit(`response.${event.requestId}`, {
      data: {
        protocolVersion: '0.1.0',
        serverInfo: context.metadata || {
          name: context.context,
          version: '1.0.0'
        },
        capabilities: {
          tools: Boolean(context.capabilities.tools?.length),
          resources: Boolean(context.capabilities.resources?.length),
          prompts: Boolean(context.capabilities.prompts?.length)
        }
      }
    });
  }

  private async handleListTools(event: any, context: McpContext): Promise<void> {
    this.server!.eventBus.emit(`response.${event.requestId}`, {
      data: {
        tools: context.capabilities.tools || []
      }
    });
  }

  private async handleCallTool(event: any, context: McpContext, params: any): Promise<void> {
    const { name, arguments: args } = params;
    const sessionId = event.headers['x-session-id'];

    const tool = context.capabilities.tools?.find(t => t.name === name);
    if (!tool) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${name}' not found in context '${context.context}'`,
          statusCode: 404
        }
      });
      return;
    }

    // Validate arguments if schema provided
    if (tool.inputSchema) {
      const validation = this.validateArguments(args, tool.inputSchema);
      if (!validation.valid) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'INVALID_ARGUMENTS',
            message: validation.error,
            statusCode: 400
          }
        });
        return;
      }
    }

    // For MCP module contexts, tools are already registered with event handlers
    // in the MCP service, so we'll use the event-based execution

    // Execute tool via event (fallback or for non-MCP module contexts)
    const toolEvent = `mcp.${context.moduleId}.tool.${name}`;
    
    try {
      const response = await this.server!.eventBus.emitAndWait(
        toolEvent,
        {
          requestId: uuidv4(),
          sessionId,
          context: context.context,
          tool: name,
          arguments: args
        },
        { timeout: 30000 }
      );

      this.server!.eventBus.emit(`response.${event.requestId}`, response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TOOL_TIMEOUT',
            message: 'Tool execution timed out',
            statusCode: 504
          }
        });
      } else {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TOOL_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
            statusCode: 500
          }
        });
      }
    }
  }

  private async handleListResources(event: any, context: McpContext): Promise<void> {
    const resourceEvent = `mcp.${context.moduleId}.resource.list`;
    
    try {
      const response = await this.server!.eventBus.emitAndWait(
        resourceEvent,
        {
          requestId: uuidv4(),
          context: context.context
        },
        { timeout: 5000 }
      );

      this.server!.eventBus.emit(`response.${event.requestId}`, 
        response.data ? response : { data: { resources: context.capabilities.resources || [] } }
      );
    } catch (error) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        data: { resources: context.capabilities.resources || [] }
      });
    }
  }

  private async handleReadResource(event: any, context: McpContext, params: any): Promise<void> {
    const { uri } = params;
    
    // For MCP module contexts with saved resources, read from database
    if (context.moduleId === 'mcp' && this.mcpModule) {
      try {
        // Get the full resource data from the module
        const repositories = this.mcpModule.getRepositories();
        const resources = await repositories.resources.findByContextId(context.context);
        const resource = resources.find(r => r.uri === uri);
        
        if (!resource) {
          this.server!.eventBus.emit(`response.${event.requestId}`, {
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: `Resource '${uri}' not found`,
              statusCode: 404
            }
          });
          return;
        }
        
        // Return the resource content
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          data: {
            contents: [{
              uri: resource.uri,
              mimeType: resource.mime_type || 'text/plain',
              text: typeof resource.content === 'string' ? resource.content : JSON.stringify(resource.content)
            }]
          }
        });
      } catch (error) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'RESOURCE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to read resource',
            statusCode: 500
          }
        });
      }
    } else {
      // Fall back to event-based handling for other modules
      const resourceEvent = `mcp.${context.moduleId}.resource.read`;
      
      try {
        const response = await this.server!.eventBus.emitAndWait(
          resourceEvent,
          {
            requestId: uuidv4(),
            context: context.context,
            uri
          },
          { timeout: 10000 }
        );

        this.server!.eventBus.emit(`response.${event.requestId}`, response);
      } catch (error) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: `Resource '${uri}' not found`,
            statusCode: 404
          }
        });
      }
    }
  }

  private async handleListPrompts(event: any, context: McpContext): Promise<void> {
    const promptEvent = `mcp.${context.moduleId}.prompt.list`;
    
    try {
      const response = await this.server!.eventBus.emitAndWait(
        promptEvent,
        {
          requestId: uuidv4(),
          context: context.context
        },
        { timeout: 5000 }
      );

      this.server!.eventBus.emit(`response.${event.requestId}`, 
        response.data ? response : { data: { prompts: context.capabilities.prompts || [] } }
      );
    } catch (error) {
      this.server!.eventBus.emit(`response.${event.requestId}`, {
        data: { prompts: context.capabilities.prompts || [] }
      });
    }
  }

  private async handleGetPrompt(event: any, context: McpContext, params: any): Promise<void> {
    const { name, arguments: args } = params;
    
    // For MCP module contexts with saved prompts, read from database
    if (context.moduleId === 'mcp' && this.mcpModule) {
      try {
        // Get the full prompt data from the module
        const repositories = this.mcpModule.getRepositories();
        const prompts = await repositories.prompts.findByContextId(context.context);
        const prompt = prompts.find(p => p.name === name);
        
        if (!prompt) {
          this.server!.eventBus.emit(`response.${event.requestId}`, {
            error: {
              code: 'PROMPT_NOT_FOUND',
              message: `Prompt '${name}' not found`,
              statusCode: 404
            }
          });
          return;
        }
        
        // Replace template variables
        let result = prompt.template;
        if (args) {
          for (const [key, value] of Object.entries(args)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          }
        }
        
        // Return the processed prompt
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          data: {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: result
              }
            }]
          }
        });
      } catch (error) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'PROMPT_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get prompt',
            statusCode: 500
          }
        });
      }
    } else {
      // Fall back to event-based handling for other modules
      const promptEvent = `mcp.${context.moduleId}.prompt.get`;
      
      try {
        const response = await this.server!.eventBus.emitAndWait(
          promptEvent,
          {
            requestId: uuidv4(),
            context: context.context,
            name,
            arguments: args
          },
          { timeout: 5000 }
        );

        this.server!.eventBus.emit(`response.${event.requestId}`, response);
      } catch (error) {
        this.server!.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'PROMPT_NOT_FOUND',
            message: `Prompt '${name}' not found`,
            statusCode: 404
          }
        });
      }
    }
  }

  private validateArguments(args: any, schema: any): { valid: boolean; error?: string } {
    if (schema.type === 'object' && schema.properties) {
      if (typeof args !== 'object' || args === null) {
        return { valid: false, error: 'Arguments must be an object' };
      }

      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in args)) {
            return { valid: false, error: `Missing required field: ${field}` };
          }
        }
      }

      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in args) {
          const value = args[field];
          const { type } = fieldSchema as any;

          if (type === 'string' && typeof value !== 'string') {
            return { valid: false, error: `Field ${field} must be a string` };
          }
          if (type === 'number' && typeof value !== 'number') {
            return { valid: false, error: `Field ${field} must be a number` };
          }
          if (type === 'boolean' && typeof value !== 'boolean') {
            return { valid: false, error: `Field ${field} must be a boolean` };
          }
        }
      }
    }

    return { valid: true };
  }
}