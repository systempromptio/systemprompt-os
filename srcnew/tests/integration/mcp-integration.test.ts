import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoreMCPServer } from '../../dist/src/server/mcp/core/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import request from 'supertest';
import { createApp } from '../../dist/src/server/index.js';

describe('MCP Integration', () => {
  let app: any;
  
  beforeEach(async () => {
    // Reset module loader before creating app
    const { resetModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    resetModuleLoader();
    
    app = await createApp();
  });
  
  afterEach(async () => {
    // Clean up modules after each test
    const { getModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    const loader = getModuleLoader();
    await loader.shutdown();
  });
  
  it('should integrate core MCP server with registry', () => {
    const server = new CoreMCPServer();
    
    // Test that server can be registered
    const registry = new Map();
    registry.set(server.name, server);
    
    expect(registry.has('systemprompt-os-core')).toBe(true);
    expect(registry.get('systemprompt-os-core')).toBe(server);
  });

  it('should handle MCP session initialization', async () => {
    // Initialize MCP session using HTTP request
    const response = await request(app)
      .post('/mcp/core')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      })
      .expect(200);
    
    expect(response.headers['mcp-session-id']).toBeDefined();
    expect(response.headers['x-session-id']).toBeDefined();
    expect(response.headers['content-type']).toBe('text/event-stream');
    
    // Parse SSE response
    const lines = response.text.split('\n');
    const dataLine = lines.find(line => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    
    const jsonData = JSON.parse(dataLine!.substring(6));
    expect(jsonData).toHaveProperty('jsonrpc', '2.0');
    expect(jsonData).toHaveProperty('id', 1);
    expect(jsonData).toHaveProperty('result');
    expect(jsonData.result).toHaveProperty('protocolVersion');
    expect(jsonData.result).toHaveProperty('capabilities');
  });

  it('should list available tools', async () => {
    // Initialize session first
    const initResponse = await request(app)
      .post('/mcp/core')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      });
    
    const sessionId = initResponse.headers['mcp-session-id'];
    
    // List tools
    const toolsResponse = await request(app)
      .post('/mcp/core')
      .set('mcp-session-id', sessionId)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 2
      })
      .expect(200);
    
    // Parse SSE response
    const lines = toolsResponse.text.split('\n');
    const dataLine = lines.find(line => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    
    const jsonData = JSON.parse(dataLine!.substring(6));
    expect(jsonData).toHaveProperty('result');
    expect(jsonData.result).toHaveProperty('tools');
    expect(Array.isArray(jsonData.result.tools)).toBe(true);
    
    // Should have echo and add tools
    const tools = jsonData.result.tools;
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain('echo');
    expect(toolNames).toContain('add');
  });
  
  it('should execute echo tool', async () => {
    // Initialize session
    const initResponse = await request(app)
      .post('/mcp/core')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      });
    
    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Call echo tool
    const callResponse = await request(app)
      .post('/mcp/core')
      .set('mcp-session-id', sessionId)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: {
            message: 'Hello, MCP!'
          }
        },
        id: 3
      })
      .expect(200);
    
    // Parse SSE response
    const lines = callResponse.text.split('\n');
    const dataLine = lines.find(line => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    
    const jsonData = JSON.parse(dataLine!.substring(6));
    expect(jsonData).toHaveProperty('result');
    expect(jsonData.result).toHaveProperty('content');
    expect(jsonData.result.content[0]).toHaveProperty('type', 'text');
    expect(jsonData.result.content[0]).toHaveProperty('text', 'Echo: Hello, MCP!');
  });
  
  it('should execute add tool', async () => {
    // Initialize session
    const initResponse = await request(app)
      .post('/mcp/core')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      });
    
    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Call add tool
    const callResponse = await request(app)
      .post('/mcp/core')
      .set('mcp-session-id', sessionId)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'add',
          arguments: {
            a: 5,
            b: 3
          }
        },
        id: 4
      })
      .expect(200);
    
    // Parse SSE response
    const lines = callResponse.text.split('\n');
    const dataLine = lines.find(line => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    
    const jsonData = JSON.parse(dataLine!.substring(6));
    expect(jsonData).toHaveProperty('result');
    expect(jsonData.result).toHaveProperty('content');
    expect(jsonData.result.content[0]).toHaveProperty('type', 'text');
    expect(jsonData.result.content[0]).toHaveProperty('text', 'Result: 8');
  });

  it('should manage sessions properly', () => {
    const server = new CoreMCPServer();
    
    // Initially no sessions
    expect(server.getActiveSessionCount()).toBe(0);
    
    // Server has proper session management
    expect(server.sessions).toBeDefined();
    expect(server.sessions).toBeInstanceOf(Map);
  });
});