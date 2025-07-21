/**
 * @fileoverview Test fixtures for MCP permission testing
 */

import type { UserPermissionContext } from '@/server/mcp/core/types/permissions';
import type { MCPToolContext } from '@/server/mcp/core/types/request-context';

/**
 * Mock user contexts for testing
 */
export const mockUsers = {
  admin: {
    userId: 'admin-user-123',
    email: 'admin@example.com',
    role: 'admin' as const,
    permissions: [
      'system:read',
      'system:write',
      'admin:*',
      'container:*',
      'user:*',
      'audit:read'
    ],
    customPermissions: []
  },
  basic: {
    userId: 'basic-user-456',
    email: 'basic@example.com',
    role: 'basic' as const,
    permissions: [
      'system:read:basic',
      'container:read:own',
      'user:read:self'
    ],
    customPermissions: []
  },
  customUser: {
    userId: 'custom-user-789',
    email: 'custom@example.com',
    role: 'basic' as const,
    permissions: [
      'system:read:basic',
      'container:read:own',
      'user:read:self'
    ],
    customPermissions: [
      'system:read',
      'admin:status'
    ]
  }
} satisfies Record<string, UserPermissionContext>;

/**
 * Mock MCP contexts for testing
 */
export const mockContexts = {
  adminContext: {
    sessionId: 'admin-session-' + Date.now()
  },
  basicContext: {
    sessionId: 'basic-session-' + Date.now()
  },
  noSessionContext: {},
  expiredContext: {
    sessionId: 'expired-session-123'
  }
} satisfies Record<string, MCPToolContext>;

/**
 * Mock tool arguments for testing
 */
export const mockToolArguments = {
  checkStatusBasic: {},
  checkStatusFull: {
    includeContainers: true,
    includeUsers: true,
    includeResources: true,
    includeTunnels: true,
    includeAuditLog: true
  },
  checkStatusPartial: {
    includeResources: true,
    includeUsers: false
  },
  invalidArguments: 'not-an-object',
  nullArguments: null,
  undefinedArguments: undefined
};

/**
 * Expected responses for testing
 */
export const expectedResponses = {
  adminToolList: {
    tools: [{
      name: 'checkstatus',
      description: 'Get comprehensive system status (admin only)',
      inputSchema: {
        type: 'object',
        properties: {
          includeContainers: {
            type: 'boolean',
            description: 'Include container status information'
          },
          includeUsers: {
            type: 'boolean',
            description: 'Include active user information'
          },
          includeResources: {
            type: 'boolean',
            description: 'Include resource usage statistics'
          },
          includeTunnels: {
            type: 'boolean',
            description: 'Include Cloudflare tunnel status'
          },
          includeAuditLog: {
            type: 'boolean',
            description: 'Include recent audit log entries'
          }
        }
      }
    }]
  },
  basicToolList: {
    tools: []
  },
  systemStatus: {
    timestamp: expect.any(String),
    uptime: expect.any(Number),
    platform: expect.any(String),
    resources: {
      cpu: {
        model: expect.any(String),
        cores: expect.any(Number),
        usage: expect.any(Number)
      },
      memory: {
        total: expect.any(Number),
        free: expect.any(Number),
        used: expect.any(Number),
        usagePercent: expect.any(Number)
      },
      disk: {
        total: expect.any(Number),
        free: expect.any(Number),
        used: expect.any(Number),
        usagePercent: expect.any(Number)
      }
    },
    services: {
      mcp: {
        status: 'active',
        version: expect.any(String),
        activeSessions: expect.any(Number)
      },
      oauth: {
        status: 'active',
        tunnelActive: expect.any(Boolean),
        providers: expect.any(Array)
      }
    }
  }
};

/**
 * Error messages for testing
 */
export const errorMessages = {
  permissionDenied: (role: string, tool: string) => 
    `Permission denied: ${role} role cannot access ${tool} tool`,
  unknownTool: (tool: string) => 
    `Unknown tool: ${tool}`,
  sessionRequired: 'Session ID is required',
  argumentsRequired: 'Arguments are required',
  invalidArguments: 'Expected object, received string'
};

/**
 * Helper to create test session contexts
 */
export function createMockContext(
  sessionType: 'admin' | 'basic' | 'custom' | 'none' = 'basic'
): MCPToolContext {
  switch (sessionType) {
    case 'admin':
      return { sessionId: 'admin-test-' + Date.now() };
    case 'basic':
      return { sessionId: 'basic-test-' + Date.now() };
    case 'custom':
      return { sessionId: 'custom-test-' + Date.now() };
    case 'none':
      return {};
  }
}

/**
 * Helper to create JSON-RPC request
 */
export function createJsonRpcRequest(
  method: string,
  params: any,
  id: number = 1
) {
  return {
    jsonrpc: '2.0',
    method,
    params,
    id
  };
}

/**
 * Helper to create expected JSON-RPC response
 */
export function createJsonRpcResponse(
  result: any,
  id: number = 1
) {
  return {
    jsonrpc: '2.0',
    result,
    id
  };
}

/**
 * Helper to create expected JSON-RPC error
 */
export function createJsonRpcError(
  code: number,
  message: string,
  id: number = 1
) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message
    },
    id
  };
}