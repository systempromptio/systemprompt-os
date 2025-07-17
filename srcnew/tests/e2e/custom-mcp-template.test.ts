/**
 * @fileoverview E2E test for custom MCP template integration
 * @module tests/e2e/custom-mcp-template
 * 
 * @remarks
 * This test verifies the complete custom MCP server workflow:
 * 1. Clones the systemprompt-mcp-template repository
 * 2. Builds and integrates it as a custom MCP server
 * 3. Starts the docker container with the module
 * 4. Lists available tools from the custom server
 * 5. Executes a tool and verifies the response
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rm, mkdir, access, writeFile } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
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

/**
 * Test configuration
 */
interface TestConfig {
  /** Template repository URL */
  templateRepoUrl: string;
  /** Custom MCP directory path */
  customMcpDir: string;
  /** Template directory name */
  templateDirName: string;
  /** Server base URL */
  serverUrl: string;
  /** Test timeout in milliseconds */
  timeout: number;
}

const config: TestConfig = {
  templateRepoUrl: 'https://github.com/systempromptio/systemprompt-mcp-template',
  customMcpDir: path.join(process.cwd(), 'server', 'mcp', 'custom'),
  templateDirName: 'systemprompt-mcp-template',
  serverUrl: 'http://localhost:3000',
  timeout: 120000 // 2 minutes
};

describe('Custom MCP Template E2E Tests', () => {
  let containerId: string;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  let templatePath: string;

  beforeAll(async () => {
    console.log('🚀 Setting up custom MCP template test environment...');
    
    templatePath = path.join(config.customMcpDir, config.templateDirName);
    
    // Check if template already exists, if not clone it
    try {
      await access(templatePath, constants.F_OK);
      console.log('📦 Template already exists, pulling latest changes...');
      await execAsync('git pull', { cwd: templatePath });
    } catch {
      console.log('📦 Cloning systemprompt-mcp-template...');
      await mkdir(config.customMcpDir, { recursive: true });
      await execAsync(`git clone ${config.templateRepoUrl} ${templatePath}`);
    }
    
    // Build the template
    console.log('🔨 Building MCP template...');
    await execAsync('npm install', { cwd: templatePath });
    await execAsync('npm run build', { cwd: templatePath });
    
    // Create custom docker-compose file for this test
    const dockerComposeContent = `
version: '3.8'

services:
  mcp-custom-test:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MCP_CUSTOM_ENABLED=true
    volumes:
      - ./server/mcp/custom:/app/server/mcp/custom:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/status"]
      interval: 5s
      timeout: 3s
      retries: 20
`;
    
    await writeFile('docker-compose.custom-test.yml', dockerComposeContent);
    
    // Build and start the container
    console.log('🐳 Building and starting Docker container...');
    await execAsync('docker-compose -f docker-compose.custom-test.yml build');
    await execAsync('docker-compose -f docker-compose.custom-test.yml up -d');
    
    // Get container ID
    const { stdout: containerInfo } = await execAsync('docker-compose -f docker-compose.custom-test.yml ps -q mcp-custom-test');
    containerId = containerInfo.trim();
    
    // Wait for container to be healthy
    console.log('⏳ Waiting for container to be healthy...');
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
    
    // Verify custom MCP server is loaded
    console.log('🔍 Verifying custom MCP server is loaded...');
    const statusResponse = await fetch(`${config.serverUrl}/mcp/status`);
    const status = await statusResponse.json();
    
    if (!status.servers[config.templateDirName]) {
      throw new Error(`Custom MCP server '${config.templateDirName}' not found in server registry`);
    }
    
    // Initialize MCP client for the custom server
    const customServerUrl = new URL(`${config.serverUrl}/mcp/${config.templateDirName}`);
    transport = new StreamableHTTPClientTransport(customServerUrl);
    
    client = new Client({
      name: 'custom-mcp-test-client',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
    });
    
    await client.connect(transport);
    console.log('✅ Connected to custom MCP server');
    
  }, config.timeout);
  
  afterAll(async () => {
    // Close MCP client
    if (client) {
      await client.close();
    }
    if (transport) {
      await transport.close();
    }
    
    console.log('🛑 Stopping Docker container...');
    await execAsync('docker-compose -f docker-compose.custom-test.yml down');
    
    // Clean up test docker-compose file
    await rm('docker-compose.custom-test.yml', { force: true });
  });

  describe('Custom MCP Server Status', () => {
    it('should show custom server in status endpoint', async () => {
      const response = await fetch(`${config.serverUrl}/mcp/status`);
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status.servers).toHaveProperty(config.templateDirName);
      
      const customServer = status.servers[config.templateDirName];
      expect(customServer.name).toBe('SystemPrompt MCP Template');
      expect(customServer.status).toBe('running');
      expect(customServer.type).toBe('local');
    });
  });

  describe('Custom MCP Tools', () => {
    it('should list custom tools from template', async () => {
      const result: ListToolsResult = await client.listTools();
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Verify example_tool from template exists
      const exampleTool = result.tools.find(t => t.name === 'example_tool');
      expect(exampleTool).toBeDefined();
      expect(exampleTool?.description).toBe('An example tool that echoes back a message');
      expect(exampleTool?.inputSchema).toBeDefined();
    });
    
    it('should execute example_tool successfully', async () => {
      const testMessage = 'Hello from Custom MCP E2E Test!';
      
      const result = await client.callTool({
        name: 'example_tool',
        arguments: { message: testMessage },
      });
      
      expect(result).toHaveProperty('content');
      const content = (result as any).content[0];
      expect(content.type).toBe('text');
      expect(content.text).toContain(testMessage);
      expect(content.text).toContain('Example tool received');
    });
  });

  describe('Custom MCP Resources', () => {
    it('should list custom resources from template', async () => {
      const result: ListResourcesResult = await client.listResources();
      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
      
      // Verify example resource exists
      const exampleResource = result.resources.find(r => r.uri === 'example://resource');
      expect(exampleResource).toBeDefined();
      expect(exampleResource?.name).toBe('Example Resource');
      expect(exampleResource?.description).toBe('An example resource for demonstration');
    });
    
    it('should read example resource', async () => {
      const result: ReadResourceResult = await client.readResource({
        uri: 'example://resource',
      });
      
      expect(result).toHaveProperty('contents');
      expect(result.contents.length).toBeGreaterThan(0);
      
      const content = result.contents[0];
      expect(content.mimeType).toBe('text/plain');
      expect(content.text).toContain('This is an example resource');
    });
  });

  describe('Custom MCP Prompts', () => {
    it('should list custom prompts from template', async () => {
      const result: ListPromptsResult = await client.listPrompts();
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts.length).toBeGreaterThan(0);
      
      // Verify example prompt exists
      const examplePrompt = result.prompts.find(p => p.name === 'example_prompt');
      expect(examplePrompt).toBeDefined();
      expect(examplePrompt?.description).toBe('An example prompt template');
      expect(examplePrompt?.arguments).toBeDefined();
    });
    
    it('should get example prompt with arguments', async () => {
      const result: GetPromptResult = await client.getPrompt({
        name: 'example_prompt',
        arguments: { 
          topic: 'MCP Integration Testing'
        },
      });
      
      expect(result).toHaveProperty('messages');
      expect(result.messages.length).toBeGreaterThan(0);
      
      const message = result.messages[0];
      expect(message.role).toBe('user');
      expect((message.content as any).type).toBe('text');
      expect((message.content as any).text).toContain('MCP Integration Testing');
      expect((message.content as any).text).toContain('example prompt about');
    });
  });

  describe('Integration with Core Server', () => {
    it('should have both core and custom servers available', async () => {
      const response = await fetch(`${config.serverUrl}/mcp/status`);
      const status = await response.json();
      
      // Verify both servers are present
      expect(status.servers).toHaveProperty('core');
      expect(status.servers).toHaveProperty(config.templateDirName);
      
      // Both should be running
      expect(status.servers.core.status).toBe('running');
      expect(status.servers[config.templateDirName].status).toBe('running');
    });
    
    it('should access core server independently', async () => {
      // Create client for core server
      const coreTransport = new StreamableHTTPClientTransport(new URL(`${config.serverUrl}/mcp/core`));
      const coreClient = new Client({
        name: 'core-test-client',
        version: '1.0.0',
      }, {
        capabilities: {},
      });
      
      try {
        await coreClient.connect(coreTransport);
        
        // List tools from core server
        const result: ListToolsResult = await coreClient.listTools();
        const toolNames = result.tools.map(t => t.name);
        
        // Verify core tools (should not have example_tool)
        expect(toolNames).toContain('echo');
        expect(toolNames).toContain('add');
        expect(toolNames).not.toContain('example_tool');
      } finally {
        await coreClient.close();
        await coreTransport.close();
      }
    });
  });
});