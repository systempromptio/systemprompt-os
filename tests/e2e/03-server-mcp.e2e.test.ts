import { describe, it, expect } from 'vitest';
import { execInContainer, TEST_CONFIG } from './bootstrap';

/**
 * Server MCP Domain E2E Tests
 * 
 * Tests the critical functionality of the MCP (Model Context Protocol) server including:
 * - MCP server initialization
 * - Tool registration and discovery
 * - Resource management
 * - Prompt templates
 * - MCP protocol communication
 */
describe('[03] Server MCP Domain', () => {
  describe('MCP Server Initialization', () => {
    it('should initialize MCP server successfully', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp).toBeDefined();
      expect(status.mcp.available).toBe(true);
      expect(status.mcp.version).toBeDefined();
    });

    it('should load core MCP handlers', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp.handlers).toBeDefined();
      expect(status.mcp.handlers).toContain('tools');
      expect(status.mcp.handlers).toContain('resources');
      expect(status.mcp.handlers).toContain('prompts');
    });
  });

  describe('Tool Registration', () => {
    it('should register core tools', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp.tools).toBeDefined();
      expect(Array.isArray(status.mcp.tools)).toBe(true);
      expect(status.mcp.tools.length).toBeGreaterThan(0);
    });

    it('should include task management tools', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const toolNames = status.mcp.tools.map((t: any) => t.name);
      expect(toolNames).toContain('create_task');
      expect(toolNames).toContain('update_task');
      expect(toolNames).toContain('end_task');
      expect(toolNames).toContain('report_task');
    });

    it('should include system tools', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const toolNames = status.mcp.tools.map((t: any) => t.name);
      expect(toolNames).toContain('check_status');
      expect(toolNames).toContain('clean_state');
      expect(toolNames).toContain('get_prompt');
    });

    it('should provide tool descriptions', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const createTaskTool = status.mcp.tools.find((t: any) => t.name === 'create_task');
      expect(createTaskTool).toBeDefined();
      expect(createTaskTool.description).toBeDefined();
      expect(createTaskTool.inputSchema).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should register core resources', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp.resources).toBeDefined();
      expect(Array.isArray(status.mcp.resources)).toBe(true);
    });

    it('should include task resources', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const resourceUris = status.mcp.resources.map((r: any) => r.uri);
      expect(resourceUris.some((uri: string) => uri.includes('task'))).toBe(true);
    });

    it('should provide resource templates', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const templates = status.mcp.resources.filter((r: any) => r.uri.includes('template'));
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('Prompt Templates', () => {
    it('should have prompt templates available', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp.prompts).toBeDefined();
      expect(Array.isArray(status.mcp.prompts)).toBe(true);
    });

    it('should include core prompt templates', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const promptNames = status.mcp.prompts.map((p: any) => p.name);
      expect(promptNames).toContain('unit_test');
      expect(promptNames).toContain('bug_fix');
      expect(promptNames).toContain('react_component');
    });

    it('should have valid prompt schemas', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      const unitTestPrompt = status.mcp.prompts.find((p: any) => p.name === 'unit_test');
      expect(unitTestPrompt).toBeDefined();
      expect(unitTestPrompt.description).toBeDefined();
      expect(unitTestPrompt.arguments).toBeDefined();
    });
  });

  describe('MCP Protocol Communication', () => {
    it('should handle MCP initialize request', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        }
      };

      const { stdout } = await execInContainer(
        `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
      );

      const response = JSON.parse(stdout);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.capabilities).toBeDefined();
    });

    it('should handle tools/list request', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const { stdout } = await execInContainer(
        `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
      );

      const response = JSON.parse(stdout);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
    });

    it('should handle resources/list request', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {}
      };

      const { stdout } = await execInContainer(
        `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
      );

      const response = JSON.parse(stdout);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeDefined();
      expect(Array.isArray(response.result.resources)).toBe(true);
    });

    it('should handle prompts/list request', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'prompts/list',
        params: {}
      };

      const { stdout } = await execInContainer(
        `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
      );

      const response = JSON.parse(stdout);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);
      expect(response.result).toBeDefined();
      expect(response.result.prompts).toBeDefined();
      expect(Array.isArray(response.result.prompts)).toBe(true);
    });

    it('should handle invalid MCP requests', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'invalid/method',
        params: {}
      };

      const { stdout } = await execInContainer(
        `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
      );

      const response = JSON.parse(stdout);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601); // Method not found
    });
  });

  describe('Custom MCP Servers', () => {
    it('should load custom MCP server configurations', async () => {
      const { stdout } = await execInContainer('test -f /app/src/server/mcp/custom/remote-servers.json && echo "exists"');
      expect(stdout.trim()).toBe('exists');
    });

    it('should support custom MCP server registration', async () => {
      const { stdout } = await execInContainer('curl -s http://localhost:3000/api/status');
      const status = JSON.parse(stdout);
      expect(status.mcp.customServers).toBeDefined();
    });
  });
});