/**
 * MCP Module Integration Tests
 * Tests the full MCP module functionality including:
 * - Context management
 * - Tool/Resource/Prompt management
 * - MCP Server creation from config
 * - Permission checking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runBootstrap } from '@/bootstrap';
import type { Bootstrap } from '@/bootstrap';
import type { MCPModule } from '@/modules/core/mcp';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

describe('MCP Module Integration', () => {
  let bootstrap: Bootstrap;
  let mcpModule: MCPModule;
  let mcp: IMCPModuleExports;

  beforeAll(async () => {
    // Bootstrap the system
    bootstrap = await runBootstrap();
    
    // Get MCP module
    const module = bootstrap.getModule('mcp');
    if (!module) {
      // MCP module might have failed to load - try to get it anyway
      console.error('MCP module not found in bootstrap, trying to load manually');
      
      // Try to create the module manually for testing
      const { createModule } = await import('@/modules/core/mcp');
      mcpModule = createModule();
      
      // Initialize the module manually
      await mcpModule.initialize();
      await mcpModule.start?.();
    } else {
      mcpModule = module as MCPModule;
    }
    
    mcp = mcpModule.exports;
    
    // Verify exports are available
    if (!mcp || !mcp.contexts || !mcp.contexts.list) {
      throw new Error('MCP module exports are not properly initialized');
    }
    
    // Ensure MCP schema is created (for testing)
    const db = bootstrap.getModule('database')?.exports;
    if (db) {
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.join(process.cwd(), 'src', 'modules', 'core', 'mcp', 'schema.sql');
      
      try {
        const schema = await fs.promises.readFile(schemaPath, 'utf-8');
        const statements = schema.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.query(statement);
            } catch (error: any) {
              // Ignore "already exists" errors
              if (!error.message?.includes('already exists')) {
                console.error('Schema error:', error.message);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load MCP schema:', error);
      }
    }
  }, 30000);

  afterAll(async () => {
    // Clean shutdown
    await bootstrap.shutdown();
  });

  beforeEach(async () => {
    // Clean up any test data if mcp is initialized
    if (mcp && mcp.contexts && mcp.contexts.list) {
      const contexts = await mcp.contexts.list();
      for (const context of contexts) {
        if (context.name.startsWith('test-')) {
          await mcp.contexts.delete(context.id);
        }
      }
    }
  });

  describe('Context Management', () => {
    it('should create a new MCP context', async () => {
      const context = await mcp.contexts.create({
        name: 'test-context',
        description: 'Test MCP context',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0'
        },
        auth_config: {
          type: 'none'
        }
      });

      expect(context).toBeDefined();
      expect(context.name).toBe('test-context');
      expect(context.description).toBe('Test MCP context');
      expect(context.is_active).toBe(true);
    });

    it('should retrieve a context by ID', async () => {
      const created = await mcp.contexts.create({
        name: 'test-get-context',
        description: 'Test get context',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0'
        }
      });

      const retrieved = await mcp.contexts.get(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('test-get-context');
    });

    it('should retrieve a context by name', async () => {
      await mcp.contexts.create({
        name: 'test-by-name',
        description: 'Test by name',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0'
        }
      });

      const retrieved = await mcp.contexts.getByName('test-by-name');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-by-name');
    });

    it('should update a context', async () => {
      const context = await mcp.contexts.create({
        name: 'test-update',
        description: 'Original description',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0'
        }
      });

      const updated = await mcp.contexts.update(context.id, {
        description: 'Updated description',
        is_active: false
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.is_active).toBe(false);
    });

    it('should delete a context', async () => {
      const context = await mcp.contexts.create({
        name: 'test-delete',
        description: 'To be deleted',
        version: '1.0.0',
        server_config: {
          name: 'Test Server',
          version: '1.0.0'
        }
      });

      await mcp.contexts.delete(context.id);

      const retrieved = await mcp.contexts.get(context.id);
      expect(retrieved).toBeNull();
    });

    it('should list contexts with filters', async () => {
      // Create multiple contexts
      await mcp.contexts.create({
        name: 'test-list-1',
        description: 'First',
        version: '1.0.0',
        server_config: { name: 'Server 1', version: '1.0.0' }
      });

      await mcp.contexts.create({
        name: 'test-list-2',
        description: 'Second',
        version: '1.0.0',
        server_config: { name: 'Server 2', version: '1.0.0' }
      });

      const inactive = await mcp.contexts.create({
        name: 'test-list-3',
        description: 'Inactive',
        version: '1.0.0',
        server_config: { name: 'Server 3', version: '1.0.0' }
      });
      
      await mcp.contexts.update(inactive.id, { is_active: false });

      // List only active contexts
      const activeContexts = await mcp.contexts.list({ is_active: true });
      const testActiveContexts = activeContexts.filter(c => c.name.startsWith('test-list-'));
      expect(testActiveContexts).toHaveLength(2);

      // List with limit
      const limited = await mcp.contexts.list({ limit: 1 });
      expect(limited).toHaveLength(1);
    });
  });

  describe('Tool Management', () => {
    let contextId: string;

    beforeEach(async () => {
      const context = await mcp.contexts.create({
        name: 'test-tools-context',
        description: 'Context for tool tests',
        version: '1.0.0',
        server_config: { name: 'Tool Test Server', version: '1.0.0' }
      });
      contextId = context.id;
    });

    it('should create a tool for a context', async () => {
      const tool = await mcp.tools.create(contextId, {
        name: 'test-tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        },
        handler_type: 'function',
        handler_config: {
          event: 'test.tool.execute'
        }
      });

      expect(tool).toBeDefined();
      expect(tool.name).toBe('test-tool');
      expect(tool.context_id).toBe(contextId);
    });

    it('should list tools for a context', async () => {
      await mcp.tools.create(contextId, {
        name: 'tool-1',
        description: 'First tool',
        input_schema: { type: 'object' },
        handler_type: 'function'
      });

      await mcp.tools.create(contextId, {
        name: 'tool-2',
        description: 'Second tool',
        input_schema: { type: 'object' },
        handler_type: 'function'
      });

      const tools = await mcp.tools.listByContext(contextId);
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('tool-1');
      expect(tools.map(t => t.name)).toContain('tool-2');
    });

    it('should get MCP SDK compatible tools', async () => {
      await mcp.tools.create(contextId, {
        name: 'sdk-tool',
        description: 'SDK compatible tool',
        input_schema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler_type: 'function'
      });

      const mcpTools = await mcp.tools.getMcpTools(contextId);
      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0].name).toBe('sdk-tool');
      expect(mcpTools[0].inputSchema).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    let contextId: string;

    beforeEach(async () => {
      const context = await mcp.contexts.create({
        name: 'test-resources-context',
        description: 'Context for resource tests',
        version: '1.0.0',
        server_config: { name: 'Resource Test Server', version: '1.0.0' }
      });
      contextId = context.id;
    });

    it('should create a resource for a context', async () => {
      const resource = await mcp.resources.create(contextId, {
        uri: 'test://resource',
        name: 'Test Resource',
        description: 'A test resource',
        mime_type: 'application/json',
        content_type: 'static',
        content: { data: 'test' }
      });

      expect(resource).toBeDefined();
      expect(resource.uri).toBe('test://resource');
      expect(resource.context_id).toBe(contextId);
    });

    it('should list resources for a context', async () => {
      await mcp.resources.create(contextId, {
        uri: 'test://resource1',
        name: 'Resource 1',
        mime_type: 'text/plain',
        content_type: 'static',
        content: 'content1'
      });

      await mcp.resources.create(contextId, {
        uri: 'test://resource2',
        name: 'Resource 2',
        mime_type: 'text/plain',
        content_type: 'static',
        content: 'content2'
      });

      const resources = await mcp.resources.listByContext(contextId);
      expect(resources).toHaveLength(2);
      expect(resources.map(r => r.uri)).toContain('test://resource1');
      expect(resources.map(r => r.uri)).toContain('test://resource2');
    });

    it('should get MCP SDK compatible resources', async () => {
      await mcp.resources.create(contextId, {
        uri: 'test://sdk-resource',
        name: 'SDK Resource',
        description: 'SDK compatible resource',
        mime_type: 'application/json',
        content_type: 'static',
        content: { test: true }
      });

      const mcpResources = await mcp.resources.getMcpResources(contextId);
      expect(mcpResources).toHaveLength(1);
      expect(mcpResources[0].uri).toBe('test://sdk-resource');
      expect(mcpResources[0].mimeType).toBe('application/json');
    });
  });

  describe('Prompt Management', () => {
    let contextId: string;

    beforeEach(async () => {
      const context = await mcp.contexts.create({
        name: 'test-prompts-context',
        description: 'Context for prompt tests',
        version: '1.0.0',
        server_config: { name: 'Prompt Test Server', version: '1.0.0' }
      });
      contextId = context.id;
    });

    it('should create a prompt for a context', async () => {
      const prompt = await mcp.prompts.create(contextId, {
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [
          {
            name: 'name',
            description: 'Name to use in prompt',
            required: true
          }
        ],
        template: 'Hello {{name}}!'
      });

      expect(prompt).toBeDefined();
      expect(prompt.name).toBe('test-prompt');
      expect(prompt.context_id).toBe(contextId);
      expect(prompt.template).toBe('Hello {{name}}!');
    });

    it('should list prompts for a context', async () => {
      await mcp.prompts.create(contextId, {
        name: 'prompt-1',
        description: 'First prompt',
        template: 'Template 1'
      });

      await mcp.prompts.create(contextId, {
        name: 'prompt-2',
        description: 'Second prompt',
        template: 'Template 2'
      });

      const prompts = await mcp.prompts.listByContext(contextId);
      expect(prompts).toHaveLength(2);
      expect(prompts.map(p => p.name)).toContain('prompt-1');
      expect(prompts.map(p => p.name)).toContain('prompt-2');
    });

    it('should get MCP SDK compatible prompts', async () => {
      await mcp.prompts.create(contextId, {
        name: 'sdk-prompt',
        description: 'SDK compatible prompt',
        arguments: [
          {
            name: 'input',
            description: 'Input value',
            required: false
          }
        ],
        template: 'Process: {{input}}'
      });

      const mcpPrompts = await mcp.prompts.getMcpPrompts(contextId);
      expect(mcpPrompts).toHaveLength(1);
      expect(mcpPrompts[0].name).toBe('sdk-prompt');
      expect(mcpPrompts[0].arguments).toBeDefined();
      expect(mcpPrompts[0].arguments).toHaveLength(1);
    });
  });

  describe('MCP Server Creation', () => {
    it('should create an MCP server from context configuration', async () => {
      // Create a context with tools, resources, and prompts
      const context = await mcp.contexts.create({
        name: 'test-server-context',
        description: 'Context for server creation',
        version: '1.0.0',
        server_config: {
          name: 'Test MCP Server',
          version: '1.0.0'
        }
      });

      // Add a tool
      await mcp.tools.create(context.id, {
        name: 'server-tool',
        description: 'Tool for server',
        input_schema: { type: 'object' },
        handler_type: 'function'
      });

      // Add a resource
      await mcp.resources.create(context.id, {
        uri: 'server://resource',
        name: 'Server Resource',
        mime_type: 'text/plain',
        content_type: 'static',
        content: 'Server resource content'
      });

      // Add a prompt
      await mcp.prompts.create(context.id, {
        name: 'server-prompt',
        description: 'Prompt for server',
        template: 'Server prompt template'
      });

      // Create server from context
      const server = await mcp.server.createFromContext(context.id);

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Server);
      
      // The server should have the tools, resources, and prompts registered
      // Note: We can't easily test the internals of the MCP SDK Server,
      // but we can verify it was created successfully
    });

    it('should handle server creation for non-existent context', async () => {
      await expect(
        mcp.server.createFromContext('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('Permission Management', () => {
    let contextId: string;

    beforeEach(async () => {
      const context = await mcp.contexts.create({
        name: 'test-permissions-context',
        description: 'Context for permission tests',
        version: '1.0.0',
        server_config: { name: 'Permission Test Server', version: '1.0.0' }
      });
      contextId = context.id;
    });

    it('should grant permissions for a context', async () => {
      const permission = await mcp.permissions.grant(
        contextId,
        'user-123',
        'tools:execute'
      );

      expect(permission).toBeDefined();
      expect(permission.context_id).toBe(contextId);
      expect(permission.principal_id).toBe('user-123');
      expect(permission.permission).toBe('tools:execute');
    });

    it('should check if a principal has permission', async () => {
      await mcp.permissions.grant(contextId, 'user-456', 'resources:read');

      const hasPermission = await mcp.permissions.check(
        contextId,
        'user-456',
        'resources:read'
      );
      expect(hasPermission).toBe(true);

      const noPermission = await mcp.permissions.check(
        contextId,
        'user-456',
        'resources:write'
      );
      expect(noPermission).toBe(false);
    });

    it('should revoke permissions', async () => {
      await mcp.permissions.grant(contextId, 'user-789', 'prompts:use');

      const hadPermission = await mcp.permissions.check(
        contextId,
        'user-789',
        'prompts:use'
      );
      expect(hadPermission).toBe(true);

      await mcp.permissions.revoke(contextId, 'user-789', 'prompts:use');

      const hasPermission = await mcp.permissions.check(
        contextId,
        'user-789',
        'prompts:use'
      );
      expect(hasPermission).toBe(false);
    });

    it('should list permissions for a context', async () => {
      await mcp.permissions.grant(contextId, 'user-1', 'tools:execute');
      await mcp.permissions.grant(contextId, 'user-2', 'resources:read');
      await mcp.permissions.grant(contextId, 'user-1', 'prompts:use');

      const permissions = await mcp.permissions.listForContext(contextId);
      expect(permissions).toHaveLength(3);
      
      const user1Permissions = permissions.filter(p => p.principal_id === 'user-1');
      expect(user1Permissions).toHaveLength(2);
      expect(user1Permissions.map(p => p.permission)).toContain('tools:execute');
      expect(user1Permissions.map(p => p.permission)).toContain('prompts:use');
    });
  });

  describe('Seeded Data', () => {
    it('should be able to use seeded CLI context', async () => {
      // Run the seed command
      const seedModule = bootstrap.getModule('mcp') as MCPModule;
      const cliCommands = await seedModule.cliCommands();
      const seedCommand = cliCommands.find(cmd => cmd.name === 'seed');
      
      if (seedCommand && seedCommand.execute) {
        await seedCommand.execute({ force: true }, {
          module: seedModule,
          logger: LoggerService.getInstance() as any
        });
      }

      // Check that CLI context was created
      const cliContext = await mcp.contexts.getByName('cli');
      expect(cliContext).toBeDefined();
      expect(cliContext?.description).toContain('CLI tools');

      // Check that tools were created
      const tools = await mcp.tools.listByContext(cliContext!.id);
      expect(tools.map(t => t.name)).toContain('execute-cli');
      expect(tools.map(t => t.name)).toContain('system-status');

      // Check that resources were created
      const resources = await mcp.resources.listByContext(cliContext!.id);
      expect(resources.map(r => r.uri)).toContain('system://info');
      expect(resources.map(r => r.uri)).toContain('system://modules');
    });
  });
});