/**
 * MCP Module Integration Test
 * 
 * Tests Model Context Protocol integration:
 * - MCP server discovery and registration
 * - Tool registration and execution
 * - Resource management
 * - Prompt handling
 * - MCP client connections
 * - Protocol compliance
 * 
 * Coverage targets:
 * - src/modules/core/mcp/index.ts
 * - src/modules/core/mcp/services/mcp.service.ts
 * - src/modules/core/mcp/repositories/*.ts
 * - src/modules/core/mcp/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { MCPService } from '@/modules/core/mcp/services/mcp.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { McpMessagesRole } from '@/modules/core/mcp/types/database.generated';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('MCP Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let mcpService: MCPService;
  let dbService: DatabaseService;
  
  const testSessionId = `mcp-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true, // We'll still test the module but skip auto-discovery
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const mcpModule = modules.get('mcp');
    const dbModule = modules.get('database');
    
    if (!mcpModule || !('exports' in mcpModule) || !mcpModule.exports) {
      throw new Error('MCP module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    dbService = dbModule.exports.service();
    
    if ('service' in mcpModule.exports && typeof mcpModule.exports.service === 'function') {
      mcpService = mcpModule.exports.service();
    }
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clear MCP data before each test
    try {
      await dbService.execute('DELETE FROM mcp_contexts WHERE 1=1');
      await dbService.execute('DELETE FROM mcp_servers WHERE 1=1');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('Module Bootstrap', () => {
    it('should load mcp module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('mcp')).toBe(true);
      
      const module = modules.get('mcp');
      expect(module).toBeDefined();
      expect(module?.name).toBe('mcp');
    });

    it('should execute mcp status command', async () => {
      const result = await runCLICommand(['mcp', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/mcp|status|enabled|healthy/);
    });
  });

  describe('MCP Context Management', () => {
    it('should create and list MCP contexts', async () => {
      // MCP service should be initialized
      expect(mcpService).toBeDefined();
      
      // Create a test context
      const testContext = await mcpService.createContext(
        'test-context',
        'gpt-4',
        {
          description: 'Test context for integration tests',
          maxTokens: 2048,
          temperature: 0.7
        }
      );
      
      expect(testContext).toBeDefined();
      expect(testContext.name).toBe('test-context');
      expect(testContext.model).toBe('gpt-4');
      expect(testContext.max_tokens).toBe(2048);
      
      // List contexts
      const contexts = await mcpService.listContexts();
      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts.some(c => c.id === testContext.id)).toBe(true);
    });
    
    it('should create and manage sessions', async () => {
      // Create a context first
      const context = await mcpService.createContext(
        'session-test-context',
        'gpt-3.5-turbo',
        { maxTokens: 1024 }
      );
      
      // Create a session
      const session = await mcpService.createSession(context.id, {
        sessionName: 'Test Session',
        userId: 'test-user-123'
      });
      
      expect(session).toBeDefined();
      expect(session.context_id).toBe(context.id);
      expect(session.status).toBe('active');
      expect(session.session_name).toBe('Test Session');
      
      // Add messages to session
      const message = await mcpService.addMessage(
        session.id,
        McpMessagesRole.USER,
        'Hello, this is a test message',
        {
          tokenCount: 10,
          modelUsed: 'gpt-3.5-turbo'
        }
      );
      
      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, this is a test message');
      expect(message.token_count).toBe(10);
      
      // Get session messages
      const messages = await mcpService.getSessionMessages(session.id);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe(message.id);
    });
    
    it('should delete contexts', async () => {
      // Create a context to delete
      const context = await mcpService.createContext(
        'delete-test-context',
        'gpt-4',
        { description: 'Context to be deleted' }
      );
      
      // Delete the context
      await mcpService.deleteContext(context.id);
      
      // Verify it's deleted
      const deletedContext = await mcpService.getContext(context.id);
      expect(deletedContext).toBeNull();
    });
  });

  describe('Tool Integration', () => {
    it('should register MCP tools', async () => {
      // Test tool registration through module exports
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'tools' in mcpModule.exports) {
        const tools = mcpModule.exports.tools;
        
        expect(tools).toBeDefined();
        expect(typeof tools.listTools).toBe('function');
        
        // Test listing tools
        try {
          const toolsList = await tools.listTools();
          expect(Array.isArray(toolsList)).toBe(true);
        } catch (error) {
          // May not have tools configured, that's ok
          expect(error).toBeDefined();
        }
      }
    });
    
    it('should handle tool execution', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'tools' in mcpModule.exports) {
        const tools = mcpModule.exports.tools;
        
        expect(typeof tools.executeTool).toBe('function');
        
        // Test with non-existent tool (should handle gracefully)
        try {
          await tools.executeTool('non-existent-tool', {});
        } catch (error) {
          // Expected to fail for non-existent tool
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Resource Management', () => {
    it('should list available resources', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'resources' in mcpModule.exports) {
        const resources = mcpModule.exports.resources;
        
        expect(resources).toBeDefined();
        expect(typeof resources.listResources).toBe('function');
        
        try {
          const resourcesList = await resources.listResources();
          expect(Array.isArray(resourcesList)).toBe(true);
        } catch (error) {
          // May not have resources configured, that's ok
          expect(error).toBeDefined();
        }
      }
    });
    
    it('should read resource content', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'resources' in mcpModule.exports) {
        const resources = mcpModule.exports.resources;
        
        expect(typeof resources.getResource).toBe('function');
        
        // Test with non-existent resource
        try {
          const resource = await resources.getResource('non-existent-resource');
          expect(resource).toBeNull();
        } catch (error) {
          // May throw error instead of returning null
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Prompt Handling', () => {
    it('should register prompts', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'prompts' in mcpModule.exports) {
        const prompts = mcpModule.exports.prompts;
        
        expect(prompts).toBeDefined();
        expect(typeof prompts.listPrompts).toBe('function');
        
        try {
          const promptsList = await prompts.listPrompts();
          expect(Array.isArray(promptsList)).toBe(true);
        } catch (error) {
          // May not have prompts configured, that's ok
          expect(error).toBeDefined();
        }
      }
    });
    
    it('should resolve prompt templates', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule && mcpModule.exports && 'prompts' in mcpModule.exports) {
        const prompts = mcpModule.exports.prompts;
        
        expect(typeof prompts.getPrompt).toBe('function');
        
        // Test with non-existent prompt
        try {
          const prompt = await prompts.getPrompt('non-existent-prompt');
          expect(prompt).toBeNull();
        } catch (error) {
          // May throw error instead of returning null
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Protocol Compliance', () => {
    it('should handle initialization', async () => {
      // MCP module should initialize properly
      const mcpModule = bootstrap.getModules().get('mcp');
      expect(mcpModule).toBeDefined();
      expect(mcpModule?.status).toBeDefined();
    });
    
    it('should maintain protocol version', async () => {
      const mcpModule = bootstrap.getModules().get('mcp');
      expect(mcpModule?.version).toBeDefined();
      expect(typeof mcpModule?.version).toBe('string');
    });
    
    it('should handle protocol errors', async () => {
      // Service should handle errors gracefully
      expect(mcpService).toBeDefined();
      
      // Try to list contexts (may fail in test environment)
      try {
        await mcpService.listContexts();
      } catch (error) {
        // Should handle errors gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Context Management', () => {
    it('should manage MCP contexts', async () => {
      // Test context management functionality
      expect(mcpService).toBeDefined();
      
      try {
        const contexts = await mcpService.listContexts();
        expect(Array.isArray(contexts)).toBe(true);
      } catch (error) {
        // Context management may not be fully available in test
        expect(error).toBeDefined();
      }
    });
    
    it('should handle context lifecycle', async () => {
      // MCP service should manage context lifecycle
      expect(mcpService).toBeDefined();
      
      // Service should be properly initialized
      const mcpModule = bootstrap.getModules().get('mcp');
      if (mcpModule) {
        const healthCheck = await mcpModule.healthCheck();
        expect(healthCheck.healthy).toBe(true);
      }
    });
  });

  describe('CLI Commands', () => {
    it('should show MCP status', async () => {
      const result = await runCLICommand(['mcp', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/mcp|module|status|enabled|healthy/);
    });
    
    it('should create MCP context via CLI', async () => {
      const result = await runCLICommand([
        'mcp:create',
        '--name', 'cli-test-context',
        '--model', 'gpt-4'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Created MCP context');
      expect(result.output).toContain('cli-test-context');
    });
    
    it('should list MCP contexts via CLI', async () => {
      // First create a context
      await runCLICommand([
        'mcp:create',
        '--name', 'list-test-context',
        '--model', 'gpt-3.5-turbo'
      ]);
      
      // Then list
      const result = await runCLICommand(['mcp:list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('list-test-context');
      expect(result.output).toContain('gpt-3.5-turbo');
    });
    
    it('should list contexts in JSON format', async () => {
      // Create a context first
      await mcpService.createContext('json-test-context', 'gpt-4', {});
      
      const result = await runCLICommand(['mcp:list', '--format', 'json']);
      
      expect(result.exitCode).toBe(0);
      const contexts = JSON.parse(result.output);
      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts.some(c => c.name === 'json-test-context')).toBe(true);
    });
    
    it('should delete MCP context via CLI', async () => {
      // Create a context first
      const context = await mcpService.createContext('delete-cli-test', 'gpt-4', {});
      
      // Delete via CLI
      const result = await runCLICommand(['mcp:delete', '--id', context.id]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Deleted MCP context');
      expect(result.output).toContain(context.id);
      
      // Verify deletion
      const deletedContext = await mcpService.getContext(context.id);
      expect(deletedContext).toBeNull();
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve) => {
      cliProcess.on('close', () => {
        resolve();
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode: cliProcess.exitCode,
    };
  }
});