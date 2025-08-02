/**
 * Direct SDK Handler for MCP Protocol
 * Directly uses MCP SDK Server instances to process messages
 */

import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IServerCore } from '../../core/types/server.types';
import type { McpContext } from './types/mcp.types';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export class DirectSDKHandler {
  private server: IServerCore;
  private contexts: Map<string, McpContext>;
  private sessions: Map<string, any> = new Map();
  private mcpServers: Map<string, Server> = new Map();

  constructor(server: IServerCore, contexts: Map<string, McpContext>) {
    this.server = server;
    this.contexts = contexts;
  }

  /**
   * Handle MCP requests using SDK Server instances directly
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
  private async handleSSEStream(
    req: Request, 
    res: Response, 
    contextName: string, 
    sessionId: string
  ): Promise<void> {
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
  private async handlePostMessage(
    req: Request,
    res: Response,
    contextName: string,
    sessionId: string
  ): Promise<void> {
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

    const session = this.sessions.get(sessionId) || {
      id: sessionId,
      context: contextName,
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, session);
    }
    session.lastActivity = new Date();

    const message = req.body;

    // Get or create MCP SDK Server for this context
    let mcpServer = this.mcpServers.get(contextName);
    if (!mcpServer && context.moduleId === 'mcp') {
      const mcpModule = this.server.getService('mcp-module') as IMCPModuleExports;
      if (mcpModule) {
        try {
          mcpServer = await mcpModule.server.getOrCreate(context.context);
          this.mcpServers.set(contextName, mcpServer);
          
          // The SDK server already has handlers registered
          console.log(`MCP SDK Server loaded for context: ${contextName}`);
        } catch (error) {
          console.error('Failed to create MCP SDK server:', error);
        }
      }
    }

    try {
      let response: any;
      
      // If we have an SDK server, manually invoke its handlers
      if (mcpServer) {
        // The SDK server has internal request handlers we need to call
        // We'll simulate the transport by directly processing the message
        response = await this.processWithSDKServer(mcpServer, message);
      } else {
        // Fallback to manual handling for non-MCP contexts
        response = await this.handleManualMessage(context, message);
      }

      // Send response via SSE if available, otherwise via HTTP
      if (session.sse) {
        session.sse.write(`data: ${JSON.stringify(response)}\n\n`);
        res.status(202).json({ accepted: true });
      } else {
        res.json(response);
      }
    } catch (error) {
      console.error('Error processing message:', error);
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

  /**
   * Process message with SDK Server
   */
  private async processWithSDKServer(mcpServer: Server, message: any): Promise<any> {
    // The SDK server expects a specific format for handling requests
    // We need to simulate what the transport would do
    
    // Get the request handler from the server
    const handlers = (mcpServer as any)._requestHandlers;
    
    if (!handlers) {
      throw new Error('SDK Server has no request handlers');
    }
    
    // Map our message method to SDK method format
    const method = message.method;
    const params = message.params || {};
    
    // Try to find and execute the appropriate handler
    const handler = handlers.get(method);
    
    if (handler) {
      try {
        const result = await handler({ method, params });
        return {
          jsonrpc: '2.0',
          result,
          id: message.id
        };
      } catch (error) {
        throw error;
      }
    }
    
    // If no direct handler, handle standard MCP methods
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: mcpServer.serverInfo,
            capabilities: (mcpServer as any).capabilities || {
              tools: {},
              resources: {},
              prompts: {}
            }
          },
          id: message.id
        };
        
      case 'list_tools':
      case 'tools/list': {
        const listHandler = handlers.get('tools/list');
        if (listHandler) {
          const result = await listHandler({ method: 'tools/list', params: {} });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
      
      case 'call_tool':
      case 'tools/call': {
        const callHandler = handlers.get('tools/call');
        if (callHandler) {
          const result = await callHandler({ method: 'tools/call', params });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
      
      case 'list_resources':
      case 'resources/list': {
        const listHandler = handlers.get('resources/list');
        if (listHandler) {
          const result = await listHandler({ method: 'resources/list', params: {} });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
      
      case 'read_resource':
      case 'resources/read': {
        const readHandler = handlers.get('resources/read');
        if (readHandler) {
          const result = await readHandler({ method: 'resources/read', params });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
      
      case 'list_prompts':
      case 'prompts/list': {
        const listHandler = handlers.get('prompts/list');
        if (listHandler) {
          const result = await listHandler({ method: 'prompts/list', params: {} });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
      
      case 'get_prompt':
      case 'prompts/get': {
        const getHandler = handlers.get('prompts/get');
        if (getHandler) {
          const result = await getHandler({ method: 'prompts/get', params });
          return {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
        }
        break;
      }
    }
    
    // Method not found
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method '${method}' not found`
      },
      id: message.id
    };
  }

  /**
   * Handle messages manually for non-SDK contexts
   */
  private async handleManualMessage(context: McpContext, message: any): Promise<any> {
    try {
      switch (message.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
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
            },
            id: message.id
          };
          
        case 'tools/list':
          return {
            jsonrpc: '2.0',
            result: {
              tools: context.capabilities.tools || []
            },
            id: message.id
          };
          
        case 'resources/list':
          return {
            jsonrpc: '2.0',
            result: {
              resources: context.capabilities.resources || []
            },
            id: message.id
          };
          
        case 'prompts/list':
          return {
            jsonrpc: '2.0',
            result: {
              prompts: context.capabilities.prompts || []
            },
            id: message.id
          };
          
        default:
          return {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method '${message.method}' not found`
            },
            id: message.id
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: message.id
      };
    }
  }
}