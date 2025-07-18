import type { MCPSession, MCPRequest, MCPResponse } from '../../src/server/mcp/types';

export function createMCPSessionFixture(overrides?: Partial<MCPSession>): MCPSession {
  return {
    id: 'session-123',
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    },
    protocolVersion: '1.0.0',
    capabilities: {},
    createdAt: new Date(),
    lastActivity: new Date(),
    ...overrides
  };
}

export function createMCPRequestFixture<T = any>(
  method: string,
  params?: T,
  overrides?: Partial<MCPRequest>
): MCPRequest {
  return {
    jsonrpc: '2.0',
    id: 1,
    method,
    params: params || {},
    ...overrides
  };
}

export function createMCPResponseFixture<T = any>(
  result?: T,
  overrides?: Partial<MCPResponse>
): MCPResponse {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: result || {},
    ...overrides
  };
}

export const mcpFixtures = {
  initializeRequest: createMCPRequestFixture('initialize', {
    protocolVersion: '1.0.0',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }),
  
  toolsListRequest: createMCPRequestFixture('tools/list', {}),
  
  echoToolRequest: createMCPRequestFixture('tools/call', {
    name: 'echo',
    arguments: {
      message: 'Hello, World!'
    }
  }),
  
  addToolRequest: createMCPRequestFixture('tools/call', {
    name: 'add',
    arguments: {
      a: 5,
      b: 3
    }
  }),
  
  initializeResponse: createMCPResponseFixture({
    protocolVersion: '1.0.0',
    capabilities: {
      tools: true,
      resources: true
    },
    serverInfo: {
      name: 'systemprompt-os-core',
      version: '0.1.0'
    }
  }),
  
  toolsListResponse: createMCPResponseFixture({
    tools: [
      {
        name: 'echo',
        description: 'Echo back a message',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        }
      },
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
      }
    ]
  })
};