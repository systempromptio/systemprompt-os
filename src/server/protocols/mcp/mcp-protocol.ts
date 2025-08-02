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

export class McpProtocolHandlerV2 implements IProtocolHandler {
  public readonly name = 'mcp';
  private server?: IServerCore;
  private status: ServerStatus = 'initialized';
  private readonly contexts: Map<string, McpContext> = new Map();
  private readonly sessions: Map<string, McpSession> = new Map();

  async initialize(server: IServerCore): Promise<boolean> {
    this.server = server;
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Register default context
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
    
    // Register CLI tools context
    this.registerCliContext();
    
    // Register MCP endpoints with HTTP handler via events during initialization
    server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'mcp-protocol',
      endpoints: [
        {
          protocol: 'http',
          method: 'POST',
          path: '/mcp',
          handler: 'mcp.request',
          auth: { required: false }
        },
        {
          protocol: 'http',
          method: 'GET', 
          path: '/mcp/contexts',
          handler: 'mcp.contexts',
          auth: { required: false }
        }
      ]
    });
    
    // Set up handlers
    server.eventBus.on('mcp.request', async (event) => {
      await this.handleMcpRequest(event);
    });
    
    server.eventBus.on('mcp.contexts', async (event) => {
      const contexts = Array.from(this.contexts.entries()).map(([name, ctx]) => ({
        name,
        metadata: ctx.metadata,
        capabilities: {
          tools: ctx.capabilities.tools?.length || 0,
          resources: ctx.capabilities.resources?.length || 0,
          prompts: ctx.capabilities.prompts?.length || 0
        }
      }));
      
      server.eventBus.emit(`response.${event.requestId}`, {
        data: { contexts }
      });
    });

    return true;
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

    // Execute tool via event
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