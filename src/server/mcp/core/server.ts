/**
 * @fileoverview Core MCP Server with simple default tools, resources, and prompts
 * @module server/mcp/core/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type GetPromptRequest,
  type ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';

interface SessionInfo {
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastAccessed: Date;
}

export class CoreMCPServer {
  public readonly name = 'systemprompt-os-core';
  public readonly version = '0.1.0';
  private sessions = new Map<string, SessionInfo>();
  private cleanupInterval: NodeJS.Timeout;
  private readonly SESSIONTIMEOUT_MS = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    // Set up periodic cleanup of old sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Creates a new MCP server instance with handlers
   */
  private createServer( sessionId: string): Server {
    const server = new Server(
      {
        name: this.name,
        version: this.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
    
    // Set up tool handlers
    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: 'echo',
          description: 'Echo back a message',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to echo' },
            },
            required: ['message'],
          },
        },
        {
          name: 'add',
          description: 'Add two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['a', 'b'],
          },
        },
      ],
    }));
    
    server.setRequestHandler(CallToolRequestSchema, ( request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      
      switch ( name) {
        case 'echo':
          return {
            content: [
              {
                type: 'text',
                text: `Echo: ${args?.message || 'No message provided'}`,
              },
            ],
          };
        case 'add':
          const a = args?.a as number;
          const b = args?.b as number;
          return {
            content: [
              {
                type: 'text',
                text: `Result: ${a + b}`,
              },
            ],
          };
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
    
    // Set up resource handlers
    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: [
        {
          uri: 'system://info',
          name: 'System Information',
          description: 'Basic system information',
          mimeType: 'application/json',
        },
        {
          uri: 'system://status',
          name: 'System Status',
          description: 'Current system status',
          mimeType: 'application/json',
        },
      ],
    }));
    
    server.setRequestHandler(ReadResourceRequestSchema, ( request: ReadResourceRequest) => {
      const { uri } = request.params;
      
      switch ( uri) {
        case 'system://info':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  name: this.name,
                  version: this.version,
                  sessionId,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        case 'system://status':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'running',
                  sessions: this.sessions.size,
                  uptime: process.uptime(),
                }, null, 2),
              },
            ],
          };
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
    
    // Set up prompt handlers
    server.setRequestHandler(ListPromptsRequestSchema, () => ({
      prompts: [
        {
          name: 'greeting',
          description: 'Generate a greeting message',
          arguments: [
            {
              name: 'name',
              description: 'Name to greet',
              required: true,
            },
          ],
        },
        {
          name: 'codereview',
          description: 'Generate a code review template',
          arguments: [
            {
              name: 'language',
              description: 'Programming language',
              required: true,
            },
            {
              name: 'focus',
              description: 'Review focus areas',
              required: false,
            },
          ],
        },
      ],
    }));
    
    server.setRequestHandler(GetPromptRequestSchema, ( request: GetPromptRequest) => {
      const { name, arguments: args } = request.params;
      
      switch ( name) {
        case 'greeting':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please greet ${args?.name || 'Guest'} warmly.`,
                },
              },
            ],
          };
        case 'codereview':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please review the following ${args?.language || 'code'} focusing on ${args?.focus || 'best practices, performance, and maintainability'}.`,
                },
              },
            ],
          };
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
    
    return server;
  }
  
  /**
   * Handles incoming MCP requests
   */
  async handleRequest( req: Request, res: Response): Promise<void> {
    try {
      // Get or create session
      let sessionId = req.headers['mcp-session-id'] as string || req.headers['x-session-id'] as string;
      const isInitRequest = !sessionId;
      
      if ( isInitRequest) {
        // Create new session
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const server = this.createServer( sessionId);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
        });
        
        await server.connect( transport);
        
        this.sessions.set(sessionId, {
          server,
          transport,
          createdAt: new Date(),
          lastAccessed: new Date(),
        });
        
        res.setHeader('mcp-session-id', sessionId);
        res.setHeader('x-session-id', sessionId);
        await transport.handleRequest(req, res, req.body);
      } else {
        // Use existing session
        const sessionInfo = this.sessions.get( sessionId);
        if (!sessionInfo) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Session not found',
            },
            id: null,
          });
          return;
        }
        
        sessionInfo.lastAccessed = new Date();
        await sessionInfo.transport.handleRequest(req, res, req.body);
      }
    } catch ( error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
          },
          id: null,
        });
      }
    }
  }
  
  /**
   * Clean up old sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      const age = now - sessionInfo.lastAccessed.getTime();
      if (age > this.SESSIONTIMEOUT_MS) {
        sessionInfo.server.close();
        sessionInfo.transport.close();
        this.sessions.delete( sessionId);
      }
    }
  }
  
  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
  
  /**
   * Shutdown the server
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    for (const sessionInfo of this.sessions.values()) {
      sessionInfo.server.close();
      sessionInfo.transport.close();
    }
    this.sessions.clear();
  }
}

export function createMCPServer(): CoreMCPServer {
  return new CoreMCPServer();
}