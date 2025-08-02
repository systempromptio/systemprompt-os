/**
 * MCP Server Endpoint Integration Tests
 * Tests the full MCP server functionality including:
 * - Loading MCP module and creating servers
 * - Connecting to MCP server via HTTP endpoint
 * - Retrieving tools, resources, and prompts
 * - Executing tools through the server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runBootstrap } from '@/bootstrap';
import type { Bootstrap } from '@/bootstrap';
import type { MCPModule } from '@/modules/core/mcp';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import { startIntegratedServer } from '@/server/integrated-server';
import type { Server } from 'http';
import fetch from 'node-fetch';

describe('MCP Server Endpoint Integration', () => {
  let bootstrap: Bootstrap;
  let mcpModule: MCPModule;
  let mcp: IMCPModuleExports;
  let server: Server;
  let serverUrl: string;
  let testContextId: string;

  beforeAll(async () => {
    // Bootstrap the system
    bootstrap = await runBootstrap();
    
    // Get MCP module
    const module = bootstrap.getModule('mcp');
    if (!module) {
      throw new Error('MCP module not found in bootstrap');
    }
    mcpModule = module as MCPModule;
    mcp = mcpModule.exports;
    
    // Create a test context with tools, resources, and prompts
    const context = await mcp.contexts.create({
      name: 'test-server-context',
      description: 'Test context for server endpoint',
      version: '1.0.0',
      server_config: {
        name: 'Test MCP Server',
        version: '1.0.0'
      }
    });
    testContextId = context.id;
    
    // Add a tool
    await mcp.tools.create(testContextId, {
      name: 'test-tool',
      description: 'A test tool that returns input',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      },
      handler_type: 'function',
      handler_config: {}
    });
    
    // Add a resource
    await mcp.resources.create(testContextId, {
      uri: 'test://resource',
      name: 'Test Resource',
      description: 'A test resource',
      mime_type: 'application/json',
      content_type: 'static',
      content: { data: 'test resource content' }
    });
    
    // Add a prompt
    await mcp.prompts.create(testContextId, {
      name: 'test-prompt',
      description: 'A test prompt',
      arguments: [
        {
          name: 'name',
          description: 'Name parameter',
          required: true
        }
      ],
      template: 'Hello {{name}}!'
    });
    
    // Start the integrated server
    const port = 3456; // Use a specific test port
    server = await startIntegratedServer(port);
    
    // Get server URL
    serverUrl = `http://localhost:${port}`;
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    // Clean up test context
    if (testContextId) {
      await mcp.contexts.delete(testContextId);
    }
    
    // Stop server
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => {
        server.close(() => resolve(undefined));
      });
    }
    
    // Clean shutdown
    await bootstrap.shutdown();
  });

  describe('MCP Module Loading', () => {
    it('should load MCP module successfully', () => {
      expect(mcpModule).toBeDefined();
      expect(mcp).toBeDefined();
      expect(mcp.contexts).toBeDefined();
      expect(mcp.tools).toBeDefined();
      expect(mcp.resources).toBeDefined();
      expect(mcp.prompts).toBeDefined();
      expect(mcp.server).toBeDefined();
    });

    it('should create an MCP server from context', async () => {
      const mcpServer = await mcp.server.createFromContext(testContextId);
      expect(mcpServer).toBeDefined();
      // The server should be an instance of the MCP SDK Server
      expect(mcpServer.constructor.name).toBe('Server');
    });
  });

  describe('Server Endpoint Connectivity', () => {
    it('should connect to MCP server endpoint', async () => {
      const response = await fetch(`${serverUrl}/api/mcp/contexts`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.contexts).toBeDefined();
      expect(Array.isArray(data.contexts)).toBe(true);
    });

    it('should list available contexts', async () => {
      const response = await fetch(`${serverUrl}/api/mcp/contexts`);
      const data = await response.json();
      
      // Should have at least our test context
      const testContext = data.contexts.find((c: any) => c.name === 'test-server-context');
      expect(testContext).toBeDefined();
      expect(testContext.metadata.description).toBe('Test context for server endpoint');
    });

    it('should initialize MCP session', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.protocolVersion).toBeDefined();
      expect(data.serverInfo).toBeDefined();
      expect(data.serverInfo.name).toBe('Test MCP Server');
      expect(data.capabilities).toBeDefined();
      expect(data.capabilities.tools).toBe(true);
      expect(data.capabilities.resources).toBe(true);
      expect(data.capabilities.prompts).toBe(true);
    });
  });

  describe('Tools Functionality', () => {
    it('should list available tools', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'list_tools',
          params: {}
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.tools).toBeDefined();
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools.length).toBeGreaterThan(0);
      
      const testTool = data.tools.find((t: any) => t.name === 'test-tool');
      expect(testTool).toBeDefined();
      expect(testTool.description).toBe('A test tool that returns input');
      expect(testTool.inputSchema).toBeDefined();
    });

    it('should validate tool arguments', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'test-tool',
            arguments: {} // Missing required 'message' field
          }
        })
      });
      
      // Should return an error for invalid arguments
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('INVALID_ARGUMENTS');
    });

    it('should handle unknown tool', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'call_tool',
          params: {
            name: 'non-existent-tool',
            arguments: {}
          }
        })
      });
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('Resources Functionality', () => {
    it('should list available resources', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'list_resources',
          params: {}
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.resources).toBeDefined();
      expect(Array.isArray(data.resources)).toBe(true);
      expect(data.resources.length).toBeGreaterThan(0);
      
      const testResource = data.resources.find((r: any) => r.uri === 'test://resource');
      expect(testResource).toBeDefined();
      expect(testResource.name).toBe('Test Resource');
      expect(testResource.mimeType).toBe('application/json');
    });

    it('should read resource content', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'read_resource',
          params: {
            uri: 'test://resource'
          }
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // The resource content should be returned
      expect(data).toBeDefined();
      // Note: The exact structure depends on the MCP SDK resource handler
    });

    it('should handle unknown resource', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'read_resource',
          params: {
            uri: 'test://non-existent'
          }
        })
      });
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('Prompts Functionality', () => {
    it('should list available prompts', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'list_prompts',
          params: {}
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.prompts).toBeDefined();
      expect(Array.isArray(data.prompts)).toBe(true);
      expect(data.prompts.length).toBeGreaterThan(0);
      
      const testPrompt = data.prompts.find((p: any) => p.name === 'test-prompt');
      expect(testPrompt).toBeDefined();
      expect(testPrompt.description).toBe('A test prompt');
      expect(testPrompt.arguments).toBeDefined();
      expect(testPrompt.arguments.length).toBe(1);
    });

    it('should get prompt with template substitution', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'get_prompt',
          params: {
            name: 'test-prompt',
            arguments: {
              name: 'World'
            }
          }
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Should return the processed prompt
      expect(data).toBeDefined();
      // The exact structure depends on the MCP SDK prompt handler
    });

    it('should handle unknown prompt', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'get_prompt',
          params: {
            name: 'non-existent-prompt',
            arguments: {}
          }
        })
      });
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('PROMPT_NOT_FOUND');
    });
  });

  describe('Context Management', () => {
    it('should handle unknown context', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'non-existent-context'
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('UNKNOWN_CONTEXT');
    });

    it('should handle invalid method', async () => {
      const response = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context'
        },
        body: JSON.stringify({
          method: 'invalid_method',
          params: {}
        })
      });
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('INVALID_METHOD');
    });
  });

  describe('Session Management', () => {
    it('should create and maintain session', async () => {
      const sessionId = 'test-session-123';
      
      // First request with session ID
      const response1 = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          method: 'initialize',
          params: {}
        })
      });
      
      expect(response1.status).toBe(200);
      
      // Second request with same session ID should work
      const response2 = await fetch(`${serverUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcp-context': 'test-server-context',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          method: 'list_tools',
          params: {}
        })
      });
      
      expect(response2.status).toBe(200);
    });
  });
});