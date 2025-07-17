/**
 * @fileoverview E2E test for MCP server in Docker container using MCP SDK
 * @module test/e2e/mcp-server.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CallToolResult,
  ListResourcesResult,
  ListToolsResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';

const execAsync = promisify(exec);

describe('MCP Server E2E Tests', () => {
  let containerId: string;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  
  beforeAll(async () => {
    console.log('Starting Docker container...');
    
    // Build and start the container
    await execAsync('docker-compose -f docker-compose.mcp.yml build');
    await execAsync('docker-compose -f docker-compose.mcp.yml up -d');
    
    // Get container ID
    const { stdout: containerInfo } = await execAsync('docker-compose -f docker-compose.mcp.yml ps -q mcp-server');
    containerId = containerInfo.trim();
    
    // Wait for container to be healthy
    console.log('Waiting for container to be healthy...');
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      try {
        const { stdout: health } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerId}`);
        if (health.trim() === 'healthy') {
          healthy = true;
          break;
        }
      } catch (error) {
        // Container might not be ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (!healthy) {
      throw new Error('Container failed to become healthy');
    }
    
    // Initialize MCP client using SDK
    transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
    
    client = new Client({
      name: 'mcp-test-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
    
    await client.connect(transport);
  }, 120000); // 2 minute timeout for container startup
  
  afterAll(async () => {
    // Close MCP client
    if (client) {
      await client.close();
    }
    if (transport) {
      await transport.close();
    }
    
    console.log('Stopping Docker container...');
    await execAsync('docker-compose -f docker-compose.mcp.yml down');
  });
  
  describe('Server Status', () => {
    it('should return server status', async () => {
      const response = await fetch('http://localhost:3000/mcp/status');
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status).toHaveProperty('servers');
      expect(status.servers).toHaveProperty('core');
      expect(status.servers.core.status).toBe('running');
    });
  });
  
  describe('Tools', () => {
    it('should list available tools', async () => {
      const result: ListToolsResult = await client.listTools();
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('echo');
      expect(toolNames).toContain('add');
    });
    
    it('should execute echo tool', async () => {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'Hello MCP!' },
      });
      expect(result).toHaveProperty('content');
      expect((result as any).content[0].type).toBe('text');
      expect((result as any).content[0].text).toBe('Echo: Hello MCP!');
    });
    
    it('should execute add tool', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { a: 5, b: 3 },
      });
      expect(result).toHaveProperty('content');
      expect((result as any).content[0].type).toBe('text');
      expect((result as any).content[0].text).toBe('Result: 8');
    });
  });
  
  describe('Resources', () => {
    it('should list available resources', async () => {
      const result: ListResourcesResult = await client.listResources();
      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
      
      const resourceUris = result.resources.map(r => r.uri);
      expect(resourceUris).toContain('system://info');
      expect(resourceUris).toContain('system://status');
    });
    
    it('should read system info resource', async () => {
      const result: ReadResourceResult = await client.readResource({
        uri: 'system://info',
      });
      expect(result).toHaveProperty('contents');
      expect(result.contents[0].mimeType).toBe('application/json');
      expect(result.contents[0]).toHaveProperty('text');
      
      const info = JSON.parse((result.contents[0] as any).text);
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('sessionId');
    });
    
    it('should read system status resource', async () => {
      const result: ReadResourceResult = await client.readResource({
        uri: 'system://status',
      });
      expect(result).toHaveProperty('contents');
      expect(result.contents[0]).toHaveProperty('text');
      
      const status = JSON.parse((result.contents[0] as any).text);
      expect(status).toHaveProperty('status');
      expect(status.status).toBe('running');
      expect(status).toHaveProperty('sessions');
      expect(status).toHaveProperty('uptime');
    });
  });
  
  describe('Prompts', () => {
    it('should list available prompts', async () => {
      const result: ListPromptsResult = await client.listPrompts();
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts.length).toBeGreaterThan(0);
      
      const promptNames = result.prompts.map(p => p.name);
      expect(promptNames).toContain('greeting');
      expect(promptNames).toContain('code_review');
    });
    
    it('should get greeting prompt', async () => {
      const result: GetPromptResult = await client.getPrompt({
        name: 'greeting',
        arguments: { name: 'Alice' },
      });
      expect(result).toHaveProperty('messages');
      expect(result.messages[0].role).toBe('user');
      expect((result.messages[0].content as any).text).toContain('Alice');
    });
    
    it('should get code review prompt', async () => {
      const result: GetPromptResult = await client.getPrompt({
        name: 'code_review',
        arguments: { 
          language: 'TypeScript',
          focus: 'security and performance',
        },
      });
      expect(result).toHaveProperty('messages');
      expect(result.messages[0].role).toBe('user');
      expect((result.messages[0].content as any).text).toContain('TypeScript');
      expect((result.messages[0].content as any).text).toContain('security and performance');
    });
  });
  
  describe('Session Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      // Create two separate clients with SDK
      const transport1 = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
      const client1 = new Client({
        name: 'test-client-1',
        version: '1.0.0',
      }, {
        capabilities: {},
      });
      
      const transport2 = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
      const client2 = new Client({
        name: 'test-client-2',
        version: '1.0.0',
      }, {
        capabilities: {},
      });
      
      try {
        await client1.connect(transport1);
        await client2.connect(transport2);
        
        // Both clients should work independently
        const result1 = await client1.callTool({
          name: 'echo',
          arguments: { message: 'Client 1' },
        });
        const result2 = await client2.callTool({
          name: 'echo',
          arguments: { message: 'Client 2' },
        });
        
        expect((result1 as any).content[0].text).toBe('Echo: Client 1');
        expect((result2 as any).content[0].text).toBe('Echo: Client 2');
      } finally {
        await client1.close();
        await client2.close();
        await transport1.close();
        await transport2.close();
      }
    });
  });
});