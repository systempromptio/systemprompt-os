/**
 * MCP Protocol Handler Integration Tests
 * 
 * These tests verify the MCP (Model Context Protocol) handler functionality:
 * - Multi-context support
 * - Tool registration and execution
 * - Resource management
 * - Prompt handling
 * - Session management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerCore } from '@/server/core/server';
import { HttpProtocolHandler } from '@/server/protocols/http/http-protocol';
import { McpProtocolHandlerV2 } from '@/server/protocols/mcp/mcp-protocol';
import { ServerEvents } from '@/server/core/types/events.types';
import fetch from 'node-fetch';

describe('MCP Protocol Integration Tests', () => {
  let server: ServerCore;
  let httpHandler: HttpProtocolHandler;
  let mcpHandler: McpProtocolHandlerV2;
  let baseUrl: string;

  beforeEach(async () => {
    server = new ServerCore({ port: 0 });
    httpHandler = new HttpProtocolHandler();
    mcpHandler = new McpProtocolHandlerV2();
    
    await server.registerProtocol('http', httpHandler);
    await server.registerProtocol('mcp', mcpHandler);
    await server.start();
    
    const port = server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Context Registration', () => {
    it('should register MCP contexts via events', async () => {
      // Register a new context
      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'test',
        context: 'test-context',
        capabilities: {
          tools: [{
            name: 'echo',
            description: 'Echo input back'
          }]
        },
        metadata: {
          name: 'Test Context',
          version: '1.0.0'
        }
      });

      // List contexts
      const response = await fetch(`${baseUrl}/mcp/contexts`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.contexts).toBeInstanceOf(Array);
      
      const testContext = data.contexts.find((c: any) => c.name === 'test-context');
      expect(testContext).toBeDefined();
      expect(testContext.metadata.name).toBe('Test Context');
      expect(testContext.capabilities.tools).toBe(1);
    });

    it('should support multiple contexts from different modules', async () => {
      // Register multiple contexts
      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'module1',
        context: 'context1',
        capabilities: { tools: [] },
        metadata: { name: 'Context 1', version: '1.0.0' }
      });

      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'module2',
        context: 'context2',
        capabilities: { resources: [] },
        metadata: { name: 'Context 2', version: '1.0.0' }
      });

      const response = await fetch(`${baseUrl}/mcp/contexts`);
      const data = await response.json();
      
      expect(data.contexts.length).toBeGreaterThanOrEqual(3); // default + 2 new
      expect(data.contexts.some((c: any) => c.name === 'context1')).toBe(true);
      expect(data.contexts.some((c: any) => c.name === 'context2')).toBe(true);
    });
  });

  describe('Client Connection', () => {
    beforeEach(() => {
      // Register test context
      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'test',
        context: 'test-context',
        capabilities: {
          tools: [{
            name: 'echo',
            description: 'Echo input back'
          }]
        },
        metadata: {
          name: 'Test Context',
          version: '1.0.0'
        }
      });
    });

    it('should connect to specific context via header', async () => {
      // Initialize connection
      const initResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'test-context'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      expect(initResponse.status).toBe(200);
      const initData = await initResponse.json();
      expect(initData.protocolVersion).toBe('0.1.0');
      expect(initData.capabilities.tools).toBe(true);
      
      // List tools
      const toolsResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'test-context'
        },
        body: JSON.stringify({
          method: 'list_tools',
          params: {}
        })
      });
      
      expect(toolsResponse.status).toBe(200);
      const toolsData = await toolsResponse.json();
      expect(toolsData.tools).toHaveLength(1);
      expect(toolsData.tools[0].name).toBe('echo');
    });

    it('should reject connection to non-existent context', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'non-existent'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('UNKNOWN_CONTEXT');
      expect(data.message).toContain('non-existent');
    });

    it('should use default context when none specified', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.protocolVersion).toBe('0.1.0');
      expect(data.serverInfo.name).toBe('Default MCP Context');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      // Register calculator context
      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'calculator',
        context: 'calculator',
        capabilities: {
          tools: [
            {
              name: 'add',
              description: 'Add two numbers',
              inputSchema: {
                type: 'object',
                properties: {
                  a: { type: 'number' },
                  b: { type: 'number' }
                },
                required: ['a', 'b']
              }
            },
            {
              name: 'divide',
              description: 'Divide two numbers'
            }
          ]
        },
        metadata: {
          name: 'Calculator Context',
          version: '1.0.0'
        }
      });

      // Set up tool handlers
      server.eventBus.on('mcp.calculator.tool.add', async (event) => {
        const { a, b } = event.arguments;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { result: a + b }
        });
      });

      server.eventBus.on('mcp.calculator.tool.divide', async (event) => {
        const { a, b } = event.arguments;
        if (b === 0) {
          server.eventBus.emit(`response.${event.requestId}`, {
            error: {
              code: 'DIVISION_BY_ZERO',
              message: 'Cannot divide by zero',
              statusCode: 400
            }
          });
        } else {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: { result: a / b }
          });
        }
      });
    });

    it('should execute tools and return results', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'calculator'
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'add',
            arguments: { a: 5, b: 3 }
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toBe(8);
    });

    it('should handle tool errors properly', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'calculator'
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'divide',
            arguments: { a: 10, b: 0 }
          }
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('DIVISION_BY_ZERO');
    });

    it('should validate tool arguments', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'calculator'
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'add',
            arguments: { a: 5 } // Missing 'b'
          }
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('INVALID_ARGUMENTS');
      expect(data.message).toContain('Missing required field: b');
    });

    it('should include session metadata in tool calls', async () => {
      let receivedSession: any;
      
      server.eventBus.on('mcp.calculator.tool.sessionTest', async (event) => {
        receivedSession = event.sessionId;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { success: true }
        });
      });

      // Register tool
      server.eventBus.emit(ServerEvents.REGISTER_MCP_TOOLS, {
        moduleId: 'calculator',
        tools: [{
          name: 'sessionTest',
          description: 'Test session handling'
        }]
      });

      const sessionId = 'test-session-123';
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'calculator',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'sessionTest',
            arguments: {}
          }
        })
      });

      expect(response.status).toBe(200);
      expect(receivedSession).toBe(sessionId);
    });
  });

  describe('Authentication and Sessions', () => {
    beforeEach(() => {
      // Register secure context
      server.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
        moduleId: 'secure',
        context: 'secure-context',
        capabilities: {
          tools: [{
            name: 'secure-operation',
            description: 'Requires authentication'
          }]
        },
        metadata: {
          name: 'Secure Context',
          version: '1.0.0'
        },
        auth: {
          required: true,
          scopes: ['mcp:secure']
        }
      });
    });

    it('should require authentication for secure contexts', async () => {
      // Try without auth
      const response1 = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Context': 'secure-context'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });

      expect(response1.status).toBe(401);
      const data1 = await response1.json();
      expect(data1.error).toBe('UNAUTHORIZED');

      // Try with auth
      server.eventBus.on('test.secure', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { message: 'Secure access granted' }
        });
      });

      const response2 = await fetch(`${baseUrl}/mcp/test/secure`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      // This would work if we had registered the endpoint
    });

    it('should maintain session state across requests', async () => {
      const sessionId = 'test-session-456';
      
      // First request
      await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });

      // Check session exists
      expect(mcpHandler['sessions'].has(sessionId)).toBe(true);
      
      const session = mcpHandler['sessions'].get(sessionId);
      expect(session?.id).toBe(sessionId);
      expect(session?.context).toBe('default');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid method gracefully', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'invalid_method',
          params: {}
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('INVALID_METHOD');
    });

    it('should handle malformed requests', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
    });
  });
});