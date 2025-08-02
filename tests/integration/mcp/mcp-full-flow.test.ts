/**
 * MCP Full Flow Integration Test
 * Tests the complete MCP module and server integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Server } from 'http';
import { Express } from 'express';

// Import modules and services
import { Bootstrap } from '@/bootstrap';
import { startIntegratedServer, createIntegratedApp } from '@/server/integrated-server';
import { getModuleRegistry } from '@/modules/core/modules/index';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';

describe('MCP Full Flow Integration', () => {
  let httpServer: Server;
  let app: Express;
  let mcpModule: IMCPModuleExports;
  let contextId: string;
  
  beforeAll(async () => {
    // Bootstrap the system
    const bootstrap = new Bootstrap();
    await bootstrap.bootstrap();
    
    // Get MCP module
    const registry = getModuleRegistry();
    const mcpModuleInstance = await registry.get('mcp');
    mcpModule = mcpModuleInstance.exports as IMCPModuleExports;
    
    // Create integrated app for testing
    app = await createIntegratedApp();
    
    // Start server on a random port for testing
    httpServer = await new Promise<Server>((resolve) => {
      const server = app.listen(0, () => {
        resolve(server);
      });
    });
  }, 30000);
  
  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });
  
  beforeEach(async () => {
    // Clean up any existing test contexts
    const contexts = await mcpModule.contexts.list();
    for (const ctx of contexts) {
      if (ctx.name.startsWith('test-')) {
        await mcpModule.contexts.delete(ctx.id);
      }
    }
  });
  
  describe('MCP Module Operations', () => {
    it('should create and manage MCP contexts', async () => {
      // Create a test context
      const context = await mcpModule.contexts.create({
        name: 'test-context',
        description: 'Test MCP context',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0',
        },
      });
      
      expect(context).toBeDefined();
      expect(context.name).toBe('test-context');
      contextId = context.id;
      
      // Verify context exists
      const retrieved = await mcpModule.contexts.get(contextId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-context');
      
      // List contexts
      const contexts = await mcpModule.contexts.list();
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts.some(c => c.id === contextId)).toBe(true);
    });
    
    it('should create and manage tools', async () => {
      // Create context first
      const context = await mcpModule.contexts.create({
        name: 'test-tools-context',
        description: 'Test context for tools',
      });
      
      // Create a tool
      const tool = await mcpModule.tools.create(context.id, {
        name: 'test-tool',
        description: 'Test tool',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        handler_type: 'function',
        handler_config: {
          event: 'test.tool.execute',
        },
      });
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('test-tool');
      
      // List tools
      const tools = await mcpModule.tools.list(context.id);
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe('test-tool');
      
      // Get SDK-formatted tools
      const sdkTools = await mcpModule.tools.listAsSDK(context.id);
      expect(sdkTools.length).toBe(1);
      expect(sdkTools[0].name).toBe('test-tool');
      expect(sdkTools[0].inputSchema).toBeDefined();
    });
    
    it('should create and manage resources', async () => {
      // Create context
      const context = await mcpModule.contexts.create({
        name: 'test-resources-context',
        description: 'Test context for resources',
      });
      
      // Create static resource
      const resource = await mcpModule.resources.create(context.id, {
        uri: 'test://resource',
        name: 'Test Resource',
        description: 'A test resource',
        mime_type: 'application/json',
        content_type: 'static',
        content: { message: 'Hello, World!' },
      });
      
      expect(resource).toBeDefined();
      expect(resource.uri).toBe('test://resource');
      
      // List resources
      const resources = await mcpModule.resources.list(context.id);
      expect(resources.length).toBe(1);
      
      // Read resource
      const content = await mcpModule.resources.read(context.id, 'test://resource');
      expect(content).toEqual({ message: 'Hello, World!' });
    });
    
    it('should create and manage prompts', async () => {
      // Create context
      const context = await mcpModule.contexts.create({
        name: 'test-prompts-context',
        description: 'Test context for prompts',
      });
      
      // Create prompt
      const prompt = await mcpModule.prompts.create(context.id, {
        name: 'greeting',
        description: 'Greeting prompt',
        arguments: [
          { name: 'name', description: 'Name to greet', required: true },
        ],
        template: 'Hello {{name}}! Welcome to {{place}}.',
      });
      
      expect(prompt).toBeDefined();
      expect(prompt.name).toBe('greeting');
      
      // Get prompt with substitution
      const result = await mcpModule.prompts.get(
        context.id,
        'greeting',
        { name: 'Alice', place: 'Wonderland' }
      );
      
      expect(result).toBe('Hello Alice! Welcome to Wonderland.');
    });
    
    it('should manage permissions', async () => {
      // Create context
      const context = await mcpModule.contexts.create({
        name: 'test-permissions-context',
        description: 'Test context for permissions',
      });
      
      // Grant permission
      await mcpModule.permissions.grant(
        context.id,
        'user',
        'test-user-id',
        'execute'
      );
      
      // Check permission
      const hasPermission = await mcpModule.permissions.check(
        context.id,
        'test-user-id',
        undefined,
        'execute'
      );
      
      expect(hasPermission).toBe(true);
      
      // Check non-existent permission
      const noPermission = await mcpModule.permissions.check(
        context.id,
        'other-user-id',
        undefined,
        'execute'
      );
      
      expect(noPermission).toBe(false);
      
      // List permissions
      const permissions = await mcpModule.permissions.list(context.id);
      expect(permissions.length).toBe(1);
      expect(permissions[0].principal_id).toBe('test-user-id');
      
      // Revoke permission
      await mcpModule.permissions.revoke(
        context.id,
        'user',
        'test-user-id',
        'execute'
      );
      
      const revokedCheck = await mcpModule.permissions.check(
        context.id,
        'test-user-id',
        undefined,
        'execute'
      );
      
      expect(revokedCheck).toBe(false);
    });
  });
  
  describe('MCP Server Endpoints', () => {
    it('should initialize MCP context', async () => {
      // Create a test context
      const context = await mcpModule.contexts.create({
        name: 'test-http-context',
        description: 'Test HTTP context',
      });
      
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-http-context')
        .send({
          method: 'initialize',
          params: {},
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('protocolVersion');
      expect(response.body).toHaveProperty('serverInfo');
      expect(response.body.serverInfo.name).toBe('test-http-context');
      expect(response.body).toHaveProperty('capabilities');
    });
    
    it('should list available contexts', async () => {
      // Create test contexts
      await mcpModule.contexts.create({
        name: 'test-list-context-1',
        description: 'First test context',
      });
      
      await mcpModule.contexts.create({
        name: 'test-list-context-2',
        description: 'Second test context',
      });
      
      const response = await request(app)
        .get('/api/mcp/contexts')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('contexts');
      expect(Array.isArray(response.body.contexts)).toBe(true);
      
      const contextNames = response.body.contexts.map((c: any) => c.name);
      expect(contextNames).toContain('test-list-context-1');
      expect(contextNames).toContain('test-list-context-2');
    });
    
    it('should list tools for a context', async () => {
      // Create context with tools
      const context = await mcpModule.contexts.create({
        name: 'test-tools-http',
        description: 'Test context with tools',
      });
      
      await mcpModule.tools.create(context.id, {
        name: 'tool1',
        description: 'First tool',
        input_schema: { type: 'object', properties: {} },
        handler_type: 'function',
        handler_config: {},
      });
      
      await mcpModule.tools.create(context.id, {
        name: 'tool2',
        description: 'Second tool',
        input_schema: { type: 'object', properties: {} },
        handler_type: 'function',
        handler_config: {},
      });
      
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-tools-http')
        .send({
          method: 'list_tools',
          params: {},
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tools');
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(response.body.tools.length).toBe(2);
      
      const toolNames = response.body.tools.map((t: any) => t.name);
      expect(toolNames).toContain('tool1');
      expect(toolNames).toContain('tool2');
    });
    
    it('should execute a tool', async () => {
      // Create context with a test tool
      const context = await mcpModule.contexts.create({
        name: 'test-exec-context',
        description: 'Test execution context',
      });
      
      // Create a simple echo tool
      const tool = await mcpModule.tools.create(context.id, {
        name: 'echo',
        description: 'Echo tool',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        handler_type: 'function',
        handler_config: {
          event: 'test.echo',
        },
      });
      
      // Set up event handler for the echo tool
      const registry = getModuleRegistry();
      const events = await registry.get('events');
      
      events.exports.on('mcp.mcp.tool.echo', (event: any) => {
        const { requestId, arguments: args } = event;
        events.exports.emit(`response.${requestId}`, {
          data: {
            content: [{
              type: 'text',
              text: `Echo: ${args.message}`,
            }],
          },
        });
      });
      
      // Call the tool via HTTP
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-exec-context')
        .send({
          method: 'call_tool',
          params: {
            name: 'echo',
            arguments: {
              message: 'Hello, MCP!',
            },
          },
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content');
      expect(response.body.content[0].text).toBe('Echo: Hello, MCP!');
    });
    
    it('should handle resources', async () => {
      // Create context with resources
      const context = await mcpModule.contexts.create({
        name: 'test-resources-http',
        description: 'Test resources context',
      });
      
      await mcpModule.resources.create(context.id, {
        uri: 'test://static',
        name: 'Static Resource',
        mime_type: 'application/json',
        content_type: 'static',
        content: { data: 'test-data' },
      });
      
      // List resources
      const listResponse = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-resources-http')
        .send({
          method: 'list_resources',
          params: {},
        });
      
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toHaveProperty('resources');
      expect(listResponse.body.resources.length).toBe(1);
      expect(listResponse.body.resources[0].uri).toBe('test://static');
      
      // Read resource
      const readResponse = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-resources-http')
        .send({
          method: 'read_resource',
          params: {
            uri: 'test://static',
          },
        });
      
      expect(readResponse.status).toBe(200);
      expect(readResponse.body).toHaveProperty('contents');
      expect(readResponse.body.contents[0].text).toContain('test-data');
    });
    
    it('should handle prompts', async () => {
      // Create context with prompts
      const context = await mcpModule.contexts.create({
        name: 'test-prompts-http',
        description: 'Test prompts context',
      });
      
      await mcpModule.prompts.create(context.id, {
        name: 'greet',
        description: 'Greeting prompt',
        arguments: [
          { name: 'name', required: true },
          { name: 'time', required: false },
        ],
        template: 'Good {{time}}, {{name}}!',
      });
      
      // List prompts
      const listResponse = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-prompts-http')
        .send({
          method: 'list_prompts',
          params: {},
        });
      
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toHaveProperty('prompts');
      expect(listResponse.body.prompts.length).toBe(1);
      expect(listResponse.body.prompts[0].name).toBe('greet');
      
      // Get prompt
      const getResponse = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-prompts-http')
        .send({
          method: 'get_prompt',
          params: {
            name: 'greet',
            arguments: {
              name: 'World',
              time: 'morning',
            },
          },
        });
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('messages');
      expect(getResponse.body.messages[0].content.text).toBe('Good morning, World!');
    });
  });
  
  describe('CLI Context Integration', () => {
    beforeEach(async () => {
      // Ensure CLI context exists
      let cliContext = await mcpModule.contexts.getByName('cli');
      if (!cliContext) {
        cliContext = await mcpModule.contexts.create({
          name: 'cli',
          description: 'SystemPrompt OS CLI tools context',
          version: '1.0.0',
        });
        
        // Create execute-cli tool
        await mcpModule.tools.create(cliContext.id, {
          name: 'execute-cli',
          description: 'Execute SystemPrompt OS CLI commands',
          input_schema: {
            type: 'object',
            properties: {
              module: { type: 'string' },
              command: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } },
            },
            required: ['module', 'command'],
          },
          handler_type: 'function',
          handler_config: {
            event: 'mcp.tool.execute-cli',
          },
        });
      }
    });
    
    it('should initialize CLI context', async () => {
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'cli')
        .send({
          method: 'initialize',
          params: {},
        });
      
      expect(response.status).toBe(200);
      expect(response.body.serverInfo.name).toBe('cli');
      expect(response.body.capabilities.tools).toBe(true);
    });
    
    it('should list CLI tools', async () => {
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'cli')
        .send({
          method: 'list_tools',
          params: {},
        });
      
      expect(response.status).toBe(200);
      expect(response.body.tools).toBeDefined();
      expect(response.body.tools.some((t: any) => t.name === 'execute-cli')).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle unknown context', async () => {
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'non-existent-context')
        .send({
          method: 'initialize',
          params: {},
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('UNKNOWN_CONTEXT');
    });
    
    it('should handle unknown method', async () => {
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'cli')
        .send({
          method: 'unknown_method',
          params: {},
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('INVALID_METHOD');
    });
    
    it('should handle tool not found', async () => {
      const context = await mcpModule.contexts.create({
        name: 'test-error-context',
        description: 'Test error context',
      });
      
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-error-context')
        .send({
          method: 'call_tool',
          params: {
            name: 'non-existent-tool',
            arguments: {},
          },
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('TOOL_NOT_FOUND');
    });
    
    it('should validate tool arguments', async () => {
      const context = await mcpModule.contexts.create({
        name: 'test-validation-context',
        description: 'Test validation context',
      });
      
      await mcpModule.tools.create(context.id, {
        name: 'strict-tool',
        description: 'Tool with strict schema',
        input_schema: {
          type: 'object',
          properties: {
            required_field: { type: 'string' },
          },
          required: ['required_field'],
        },
        handler_type: 'function',
        handler_config: {},
      });
      
      const response = await request(app)
        .post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('x-mcp-context', 'test-validation-context')
        .send({
          method: 'call_tool',
          params: {
            name: 'strict-tool',
            arguments: {
              // Missing required_field
            },
          },
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('INVALID_ARGUMENTS');
      expect(response.body.message).toContain('required_field');
    });
  });
});