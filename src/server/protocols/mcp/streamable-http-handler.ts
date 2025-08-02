/**
 * Streamable HTTP Handler for MCP Protocol
 * Implements the MCP Streamable HTTP transport specification
 * with support for Server-Sent Events (SSE) for streaming responses
 */

import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IServerCore } from '../../core/types/server.types';
import type { McpContext } from './types/mcp.types';

export class StreamableHTTPHandler {
  private server: IServerCore;
  private contexts: Map<string, McpContext>;
  private sessions: Map<string, any> = new Map();

  constructor(server: IServerCore, contexts: Map<string, McpContext>) {
    this.server = server;
    this.contexts = contexts;
  }

  /**
   * Handle MCP requests with SSE support for StreamableHTTP transport
   */
  async handleStreamableRequest(req: Request, res: Response): Promise<void> {
    const contextName = req.headers['x-mcp-context'] as string || 'default';
    const sessionId = req.headers['mcp-session-id'] as string || 
                     req.headers['x-session-id'] as string || 
                     uuidv4();
    
    // Handle DELETE request for session termination
    if (req.method === 'DELETE') {
      this.sessions.delete(sessionId);
      res.status(204).send();
      return;
    }

    // Handle GET request for SSE stream
    if (req.method === 'GET') {
      await this.handleSSEStream(req, res, contextName, sessionId);
      return;
    }

    // Handle POST request for messages
    if (req.method === 'POST') {
      await this.handlePostMessage(req, res, contextName, sessionId);
      return;
    }

    res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported`
    });
  }

  /**
   * Handle SSE stream for receiving messages from server
   */
  private async handleSSEStream(req: Request, res: Response, contextName: string, sessionId: string): Promise<void> {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Mcp-Session-Id': sessionId
    });

    // Send initial connection event
    res.write(`event: open\ndata: {"sessionId":"${sessionId}"}\n\n`);

    // Store SSE response for this session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sse: res,
        context: contextName,
        createdAt: new Date()
      });
    } else {
      const session = this.sessions.get(sessionId);
      session.sse = res;
    }

    // Keep connection alive with ping
    const pingInterval = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(pingInterval);
      const session = this.sessions.get(sessionId);
      if (session?.sse === res) {
        session.sse = null;
      }
    });
  }

  /**
   * Handle POST message from client
   */
  private async handlePostMessage(req: Request, res: Response, contextName: string, sessionId: string): Promise<void> {
    const context = this.contexts.get(contextName);
    if (!context) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Context '${contextName}' not found`
        },
        id: req.body?.id || null
      });
      return;
    }

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        context: contextName,
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.sessions.set(sessionId, session);
    }
    session.lastActivity = new Date();

    // Handle JSONRPC message
    const message = req.body;
    const requestId = message.id || uuidv4();

    try {
      // Process the request based on method
      let response: any;
      
      switch (message.method) {
        case 'initialize':
          response = await this.handleInitialize(context, message.params);
          break;
        case 'tools/list':
          response = await this.handleListTools(context);
          break;
        case 'tools/call':
          response = await this.handleCallTool(context, message.params, requestId);
          break;
        case 'resources/list':
          response = await this.handleListResources(context);
          break;
        case 'resources/read':
          response = await this.handleReadResource(context, message.params, requestId);
          break;
        case 'prompts/list':
          response = await this.handleListPrompts(context);
          break;
        case 'prompts/get':
          response = await this.handleGetPrompt(context, message.params, requestId);
          break;
        default:
          response = {
            error: {
              code: -32601,
              message: `Method '${message.method}' not found`
            }
          };
      }

      // Send response
      const jsonrpcResponse = {
        jsonrpc: '2.0',
        ...response,
        id: message.id
      };

      // If we have an SSE connection for this session, send via SSE
      if (session.sse) {
        session.sse.write(`data: ${JSON.stringify(jsonrpcResponse)}\n\n`);
        // Also send minimal HTTP response
        res.status(202).json({ accepted: true });
      } else {
        // Send via regular HTTP response
        res.json(jsonrpcResponse);
      }
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: message.id
      };

      if (session.sse) {
        session.sse.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
        res.status(202).json({ accepted: true });
      } else {
        res.status(500).json(errorResponse);
      }
    }
  }

  private async handleInitialize(context: McpContext, params: any): Promise<any> {
    return {
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: context.metadata || {
          name: context.context,
          version: '1.0.0'
        },
        capabilities: {
          tools: context.capabilities.tools ? {} : undefined,
          resources: context.capabilities.resources ? {} : undefined,
          prompts: context.capabilities.prompts ? {} : undefined
        }
      }
    };
  }

  private async handleListTools(context: McpContext): Promise<any> {
    return {
      result: {
        tools: context.capabilities.tools || []
      }
    };
  }

  private async handleCallTool(context: McpContext, params: any, requestId: string): Promise<any> {
    const { name, arguments: args } = params;
    
    const tool = context.capabilities.tools?.find(t => t.name === name);
    if (!tool) {
      return {
        error: {
          code: -32602,
          message: `Tool '${name}' not found`
        }
      };
    }

    // Validate arguments if schema provided
    if (tool.inputSchema) {
      const validation = this.validateArguments(args, tool.inputSchema);
      if (!validation.valid) {
        return {
          error: {
            code: -32602,
            message: validation.error
          }
        };
      }
    }

    // Execute tool via event system
    const toolEvent = `mcp.${context.moduleId}.tool.${name}`;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.server.eventBus.off(`response.${requestId}`, responseHandler);
        resolve({
          error: {
            code: -32603,
            message: 'Tool execution timeout'
          }
        });
      }, 30000);

      const responseHandler = (response: any) => {
        clearTimeout(timeout);
        if (response.error) {
          resolve({
            error: {
              code: -32603,
              message: response.error
            }
          });
        } else {
          resolve({
            result: response.data || {
              content: [
                {
                  type: 'text',
                  text: 'Tool executed successfully'
                }
              ]
            }
          });
        }
      };

      this.server.eventBus.once(`response.${requestId}`, responseHandler);
      this.server.eventBus.emit(toolEvent, {
        requestId,
        sessionId: requestId,
        context: context.context,
        tool: name,
        arguments: args
      });
    });
  }

  private async handleListResources(context: McpContext): Promise<any> {
    return {
      result: {
        resources: context.capabilities.resources || []
      }
    };
  }

  private async handleReadResource(context: McpContext, params: any, requestId: string): Promise<any> {
    const { uri } = params;
    
    // For MCP module contexts, get resource from module
    if (context.moduleId === 'mcp') {
      const mcpModule = this.server.getService('mcp-module');
      if (mcpModule) {
        try {
          const repositories = mcpModule.getRepositories();
          const resources = await repositories.resources.findByContextId(context.context);
          const resource = resources.find((r: any) => r.uri === uri);
          
          if (!resource) {
            return {
              error: {
                code: -32602,
                message: `Resource '${uri}' not found`
              }
            };
          }
          
          return {
            result: {
              contents: [{
                uri: resource.uri,
                mimeType: resource.mime_type || 'text/plain',
                text: typeof resource.content === 'string' ? resource.content : JSON.stringify(resource.content)
              }]
            }
          };
        } catch (error) {
          return {
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Failed to read resource'
            }
          };
        }
      }
    }

    return {
      error: {
        code: -32602,
        message: `Resource '${uri}' not found`
      }
    };
  }

  private async handleListPrompts(context: McpContext): Promise<any> {
    return {
      result: {
        prompts: context.capabilities.prompts || []
      }
    };
  }

  private async handleGetPrompt(context: McpContext, params: any, requestId: string): Promise<any> {
    const { name, arguments: args } = params;
    
    // For MCP module contexts, get prompt from module
    if (context.moduleId === 'mcp') {
      const mcpModule = this.server.getService('mcp-module');
      if (mcpModule) {
        try {
          const repositories = mcpModule.getRepositories();
          const prompts = await repositories.prompts.findByContextId(context.context);
          const prompt = prompts.find((p: any) => p.name === name);
          
          if (!prompt) {
            return {
              error: {
                code: -32602,
                message: `Prompt '${name}' not found`
              }
            };
          }
          
          // Replace template variables
          let result = prompt.template;
          if (args) {
            for (const [key, value] of Object.entries(args)) {
              result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
          }
          
          return {
            result: {
              messages: [{
                role: 'user',
                content: {
                  type: 'text',
                  text: result
                }
              }]
            }
          };
        } catch (error) {
          return {
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Failed to get prompt'
            }
          };
        }
      }
    }

    return {
      error: {
        code: -32602,
        message: `Prompt '${name}' not found`
      }
    };
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