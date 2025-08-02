/**
 * SDK-based StreamableHTTP Handler for MCP Protocol
 * Uses the actual MCP SDK Server instances to handle requests
 */

import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IServerCore } from '../../core/types/server.types';
import type { McpContext } from './types/mcp.types';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export class SDKStreamableHandler {
  private server: IServerCore;
  private contexts: Map<string, McpContext>;
  private sessions: Map<string, any> = new Map();
  private mcpServers: Map<string, Server> = new Map();
  private transports: Map<string, any> = new Map();

  constructor(server: IServerCore, contexts: Map<string, McpContext>) {
    this.server = server;
    this.contexts = contexts;
  }

  /**
   * Handle MCP requests using actual SDK Server instances
   */
  async handleStreamableRequest(req: Request, res: Response): Promise<void> {
    const contextName = req.headers['x-mcp-context'] as string || 'default';
    const sessionId = req.headers['mcp-session-id'] as string || 
                     req.headers['x-session-id'] as string || 
                     uuidv4();
    
    // Get context
    const context = this.contexts.get(contextName);
    if (!context) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Context '${contextName}' not found`
        },
        id: null
      });
      return;
    }

    // Get or create MCP SDK Server for this context
    let mcpServer = this.mcpServers.get(contextName);
    if (!mcpServer && context.moduleId === 'mcp') {
      const mcpModule = this.server.getService('mcp-module') as IMCPModuleExports;
      if (mcpModule) {
        try {
          mcpServer = await mcpModule.server.getOrCreate(context.context);
          this.mcpServers.set(contextName, mcpServer);
        } catch (error) {
          console.error('Failed to create MCP SDK server:', error);
        }
      }
    }

    // Handle DELETE request for session termination
    if (req.method === 'DELETE') {
      this.sessions.delete(sessionId);
      if (this.transports.has(sessionId)) {
        const transport = this.transports.get(sessionId);
        await transport.close?.();
        this.transports.delete(sessionId);
      }
      res.status(204).send();
      return;
    }

    // Handle GET request for SSE stream
    if (req.method === 'GET') {
      await this.handleSSEStream(req, res, contextName, sessionId, mcpServer);
      return;
    }

    // Handle POST request for messages
    if (req.method === 'POST') {
      await this.handlePostMessage(req, res, contextName, sessionId, mcpServer);
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
    sessionId: string,
    mcpServer?: Server
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
   * Handle POST message from client using SDK Server
   */
  private async handlePostMessage(
    req: Request,
    res: Response,
    contextName: string,
    sessionId: string,
    mcpServer?: Server
  ): Promise<void> {
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

    // If we have an MCP SDK Server, use it directly
    if (mcpServer) {
      try {
        // Create an in-memory transport for this request
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        
        // Connect the server to the transport
        await mcpServer.connect(serverTransport);
        
        // Set up message handler to capture response
        let responseData: any = null;
        clientTransport.onmessage = (msg) => {
          responseData = msg;
        };
        
        // Send the message through the transport
        await clientTransport.send(message);
        
        // Wait a bit for response
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Close transports
        await clientTransport.close();
        await serverTransport.close();
        
        if (responseData) {
          // Send response via SSE if available, otherwise via HTTP
          if (session.sse) {
            session.sse.write(`data: ${JSON.stringify(responseData)}\n\n`);
            res.status(202).json({ accepted: true });
          } else {
            res.json(responseData);
          }
        } else {
          throw new Error('No response from server');
        }
      } catch (error) {
        console.error('Error processing with SDK server:', error);
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
    } else {
      // Fallback to manual handling for non-MCP module contexts
      const response = await this.handleManualMessage(contextName, message);
      
      if (session.sse) {
        session.sse.write(`data: ${JSON.stringify(response)}\n\n`);
        res.status(202).json({ accepted: true });
      } else {
        res.json(response);
      }
    }
  }

  /**
   * Handle messages manually for non-SDK contexts
   */
  private async handleManualMessage(contextName: string, message: any): Promise<any> {
    const context = this.contexts.get(contextName);
    if (!context) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Context '${contextName}' not found`
        },
        id: message.id
      };
    }

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