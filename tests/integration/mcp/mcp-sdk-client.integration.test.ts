/**
 * MCP SDK Client Integration Test
 * This test uses the official MCP SDK client with HTTP transport
 * to verify full MCP protocol compatibility with our server.
 * 
 * Tests:
 * - Client initialization and handshake
 * - Tool listing and execution
 * - Resource listing and reading
 * - Prompt listing and processing
 * - Error handling
 * - Session management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { runBootstrap } from '@/bootstrap';
import type { Bootstrap } from '@/bootstrap';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import { startIntegratedServer } from '@/server/integrated-server';
import type { Server } from 'http';

describe('MCP SDK Client Integration', () => {
  let bootstrap: Bootstrap;
  let mcp: IMCPModuleExports;
  let server: Server;
  let serverUrl: string;
  let testContextId: string;
  let testContextName: string;
  let mcpClient: Client;
  let transport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    // Bootstrap the system
    bootstrap = await runBootstrap();
    
    // Get MCP module
    const module = bootstrap.getModule('mcp');
    if (!module) {
      throw new Error('MCP module not found in bootstrap');
    }
    mcp = module.exports as IMCPModuleExports;
    
    // Create a test context with all capabilities
    testContextName = `sdk-test-${Date.now()}`;
    const context = await mcp.contexts.create({
      name: testContextName,
      description: 'Test context for SDK client integration',
      version: '1.0.0',
      server_config: {
        name: 'SDK Test Server',
        version: '1.0.0',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    });
    testContextId = context.id;
    
    // Add test tools
    await mcp.tools.create(testContextId, {
      name: 'echo',
      description: 'Echoes back the input message',
      input_schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo'
          }
        },
        required: ['message']
      },
      handler_type: 'function',
      handler_config: {}
    });
    
    await mcp.tools.create(testContextId, {
      name: 'calculate',
      description: 'Performs basic arithmetic',
      input_schema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'Operation to perform'
          },
          a: {
            type: 'number',
            description: 'First number'
          },
          b: {
            type: 'number',
            description: 'Second number'
          }
        },
        required: ['operation', 'a', 'b']
      },
      handler_type: 'function',
      handler_config: {}
    });
    
    // Add test resources
    await mcp.resources.create(testContextId, {
      uri: 'test://config.json',
      name: 'Configuration',
      description: 'Test configuration resource',
      mime_type: 'application/json',
      content_type: 'static',
      content: JSON.stringify({
        version: '1.0.0',
        enabled: true,
        settings: {
          debug: false,
          timeout: 30000
        }
      })
    });
    
    await mcp.resources.create(testContextId, {
      uri: 'test://data.txt',
      name: 'Data File',
      description: 'Test text data',
      mime_type: 'text/plain',
      content_type: 'static',
      content: 'This is test data for the MCP SDK client integration test.'
    });
    
    // Add test prompts
    await mcp.prompts.create(testContextId, {
      name: 'greeting',
      description: 'A greeting prompt',
      arguments: [
        {
          name: 'name',
          description: 'Name to greet',
          required: true
        },
        {
          name: 'time',
          description: 'Time of day',
          required: false
        }
      ],
      template: 'Good {{time}} {{name}}! Welcome to the MCP SDK test.'
    });
    
    await mcp.prompts.create(testContextId, {
      name: 'code-review',
      description: 'Code review prompt',
      arguments: [
        {
          name: 'language',
          description: 'Programming language',
          required: true
        },
        {
          name: 'code',
          description: 'Code to review',
          required: true
        }
      ],
      template: 'Please review this {{language}} code:\n\n{{code}}\n\nFocus on best practices and potential issues.'
    });
    
    // Start the integrated server
    const port = 4567; // Use a specific test port
    server = await startIntegratedServer(port);
    serverUrl = `http://localhost:${port}`;
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 60000);

  afterAll(async () => {
    // Clean up
    if (mcpClient) {
      await mcpClient.close();
    }
    
    if (testContextId) {
      await mcp.contexts.delete(testContextId);
    }
    
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => {
        server.close(() => resolve(undefined));
      });
    }
    
    await bootstrap.shutdown();
  });

  beforeEach(() => {
    // Reset client for each test
    if (mcpClient) {
      mcpClient.close();
    }
    mcpClient = null as any;
    transport = null as any;
  });

  describe('Client Connection and Initialization', () => {
    it('should create HTTP transport and connect to server', async () => {
      // Create HTTP transport with our server URL
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      // Create MCP client
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        }
      });
      
      // Connect to server
      await mcpClient.connect(transport);
      
      // Verify server info
      const serverInfo = mcpClient.getServerVersion();
      expect(serverInfo).toBeDefined();
      expect(serverInfo?.name).toBe('SDK Test Server');
      expect(serverInfo?.version).toBe('1.0.0');
    });

    it('should handle server capabilities correctly', async () => {
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        }
      });
      
      await mcpClient.connect(transport);
      
      // Check server capabilities
      const serverCapabilities = mcpClient.getServerCapabilities();
      expect(serverCapabilities).toBeDefined();
      // MCP capabilities are feature flags, not arrays
      expect(serverCapabilities).toHaveProperty('tools');
      expect(serverCapabilities).toHaveProperty('resources');
      expect(serverCapabilities).toHaveProperty('prompts');
    });
  });

  describe('Tools Functionality', () => {
    beforeEach(async () => {
      // Set up client for each tool test
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });
      
      await mcpClient.connect(transport);
    });

    it('should list available tools using SDK client', async () => {
      const tools = await mcpClient.listTools();
      
      expect(tools).toBeDefined();
      expect(tools.tools).toBeInstanceOf(Array);
      expect(tools.tools.length).toBe(2);
      
      // Check echo tool
      const echoTool = tools.tools.find(t => t.name === 'echo');
      expect(echoTool).toBeDefined();
      expect(echoTool?.description).toBe('Echoes back the input message');
      expect(echoTool?.inputSchema).toBeDefined();
      
      // Check calculate tool
      const calcTool = tools.tools.find(t => t.name === 'calculate');
      expect(calcTool).toBeDefined();
      expect(calcTool?.description).toBe('Performs basic arithmetic');
      expect(calcTool?.inputSchema).toBeDefined();
    });

    it('should call tool with valid arguments', async () => {
      const result = await mcpClient.callTool({
        name: 'echo',
        arguments: {
          message: 'Hello from MCP SDK client!'
        }
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      // The actual result depends on tool implementation
    });

    it('should handle tool validation errors', async () => {
      try {
        // Call with missing required argument
        await mcpClient.callTool({
          name: 'echo',
          arguments: {}
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error).toBeDefined();
        // The error message format may vary
        expect(error.message.toLowerCase()).toMatch(/required|missing/);
      }
    });

    it('should handle unknown tool error', async () => {
      try {
        await mcpClient.callTool({
          name: 'non-existent-tool',
          arguments: {}
        });
        expect.fail('Should have thrown tool not found error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Resources Functionality', () => {
    beforeEach(async () => {
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          resources: {}
        }
      });
      
      await mcpClient.connect(transport);
    });

    it('should list available resources using SDK client', async () => {
      const resources = await mcpClient.listResources();
      
      expect(resources).toBeDefined();
      expect(resources.resources).toBeInstanceOf(Array);
      expect(resources.resources.length).toBe(2);
      
      // Check config resource
      const configResource = resources.resources.find(r => r.uri === 'test://config.json');
      expect(configResource).toBeDefined();
      expect(configResource?.name).toBe('Configuration');
      expect(configResource?.mimeType).toBe('application/json');
      
      // Check data resource
      const dataResource = resources.resources.find(r => r.uri === 'test://data.txt');
      expect(dataResource).toBeDefined();
      expect(dataResource?.name).toBe('Data File');
      expect(dataResource?.mimeType).toBe('text/plain');
    });

    it('should read resource content', async () => {
      const result = await mcpClient.readResource({
        uri: 'test://config.json'
      });
      
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents).toBeInstanceOf(Array);
      expect(result.contents.length).toBeGreaterThan(0);
      
      const content = result.contents[0];
      expect(content?.uri).toBe('test://config.json');
      expect(content?.mimeType).toBe('application/json');
      
      // Parse and verify JSON content
      if (content?.text) {
        const data = JSON.parse(content.text);
        expect(data.version).toBe('1.0.0');
        expect(data.enabled).toBe(true);
        expect(data.settings).toBeDefined();
      }
    });

    it('should read text resource', async () => {
      const result = await mcpClient.readResource({
        uri: 'test://data.txt'
      });
      
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      
      const content = result.contents[0];
      expect(content?.uri).toBe('test://data.txt');
      expect(content?.mimeType).toBe('text/plain');
      expect(content?.text).toContain('test data for the MCP SDK client');
    });

    it('should handle unknown resource error', async () => {
      try {
        await mcpClient.readResource({
          uri: 'test://non-existent.txt'
        });
        expect.fail('Should have thrown resource not found error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Prompts Functionality', () => {
    beforeEach(async () => {
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          prompts: {}
        }
      });
      
      await mcpClient.connect(transport);
    });

    it('should list available prompts using SDK client', async () => {
      const prompts = await mcpClient.listPrompts();
      
      expect(prompts).toBeDefined();
      expect(prompts.prompts).toBeInstanceOf(Array);
      expect(prompts.prompts.length).toBe(2);
      
      // Check greeting prompt
      const greetingPrompt = prompts.prompts.find(p => p.name === 'greeting');
      expect(greetingPrompt).toBeDefined();
      expect(greetingPrompt?.description).toBe('A greeting prompt');
      expect(greetingPrompt?.arguments).toBeDefined();
      expect(greetingPrompt?.arguments?.length).toBe(2);
      
      // Check code-review prompt
      const codePrompt = prompts.prompts.find(p => p.name === 'code-review');
      expect(codePrompt).toBeDefined();
      expect(codePrompt?.description).toBe('Code review prompt');
      expect(codePrompt?.arguments?.length).toBe(2);
    });

    it('should get prompt with arguments', async () => {
      const result = await mcpClient.getPrompt({
        name: 'greeting',
        arguments: {
          name: 'Alice',
          time: 'morning'
        }
      });
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.messages.length).toBeGreaterThan(0);
      
      const message = result.messages[0];
      expect(message?.role).toBe('user');
      expect(message?.content).toBeDefined();
      
      // Check content includes substituted values
      const text = typeof message?.content === 'string' 
        ? message.content 
        : (message?.content as any)?.text;
      expect(text).toContain('morning');
      expect(text).toContain('Alice');
    });

    it('should handle prompt with missing optional argument', async () => {
      const result = await mcpClient.getPrompt({
        name: 'greeting',
        arguments: {
          name: 'Bob'
          // time is optional
        }
      });
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      
      const message = result.messages[0];
      const text = typeof message?.content === 'string' 
        ? message.content 
        : (message?.content as any)?.text;
      expect(text).toContain('Bob');
    });

    it('should handle unknown prompt error', async () => {
      try {
        await mcpClient.getPrompt({
          name: 'non-existent-prompt',
          arguments: {}
        });
        expect.fail('Should have thrown prompt not found error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Session Management', () => {
    it('should maintain session across multiple requests', async () => {
      const sessionId = `test-session-${Date.now()}`;
      
      // Create transport with session header
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          sessionId: sessionId,
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      });
      
      await mcpClient.connect(transport);
      
      // Make multiple requests with same session
      const tools1 = await mcpClient.listTools();
      expect(tools1.tools).toBeDefined();
      
      const resources1 = await mcpClient.listResources();
      expect(resources1.resources).toBeDefined();
      
      const prompts1 = await mcpClient.listPrompts();
      expect(prompts1.prompts).toBeDefined();
      
      // All requests should succeed with same session
      expect(tools1.tools.length).toBe(2);
      expect(resources1.resources.length).toBe(2);
      expect(prompts1.prompts.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid context gracefully', async () => {
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': 'non-existent-context'
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });
      
      try {
        await mcpClient.connect(transport);
        expect.fail('Should have thrown context not found error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Context');
      }
    });

    it('should handle server errors gracefully', async () => {
      // Create transport with valid context
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });
      
      await mcpClient.connect(transport);
      
      // Try to call tool with invalid arguments to trigger server error
      try {
        await mcpClient.callTool({
          name: 'calculate',
          arguments: {
            operation: 'invalid-op',
            a: 'not-a-number',
            b: 'also-not-a-number'
          }
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error).toBeDefined();
        // Error should be properly formatted
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple clients connecting to same context', async () => {
      // Create first client
      const transport1 = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          sessionId: 'client-1',
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      const client1 = new Client({
        name: 'client-1',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      });
      
      await client1.connect(transport1);
      
      // Create second client
      const transport2 = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          sessionId: 'client-2',
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      const client2 = new Client({
        name: 'client-2',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      });
      
      await client2.connect(transport2);
      
      // Both clients should see the same tools
      const tools1 = await client1.listTools();
      const tools2 = await client2.listTools();
      
      expect(tools1.tools.length).toBe(tools2.tools.length);
      expect(tools1.tools.map(t => t.name).sort()).toEqual(
        tools2.tools.map(t => t.name).sort()
      );
      
      // Clean up
      await client1.close();
      await client2.close();
    });

    it('should handle rapid sequential requests', async () => {
      transport = new StreamableHTTPClientTransport(
        new URL(`${serverUrl}/api/mcp`),
        {
          requestInit: {
            headers: {
              'x-mcp-context': testContextName
            }
          }
        }
      );
      
      mcpClient = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      });
      
      await mcpClient.connect(transport);
      
      // Make rapid sequential requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(mcpClient.listTools());
        promises.push(mcpClient.listResources());
        promises.push(mcpClient.listPrompts());
      }
      
      const results = await Promise.all(promises);
      
      // All requests should succeed
      expect(results.length).toBe(30);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        if (index % 3 === 0) {
          expect((result as any).tools).toBeDefined();
        } else if (index % 3 === 1) {
          expect((result as any).resources).toBeDefined();
        } else {
          expect((result as any).prompts).toBeDefined();
        }
      });
    });
  });
});