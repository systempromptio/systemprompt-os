/**
 * @fileoverview Who Am I tool for user identification
 * @module auth/tools/whoami
 */

import type { ToolDefinition } from '../../tools/types/index.js';

/**
 * Who Am I tool definition
 * Returns information about the current user
 */
export const tool: ToolDefinition = {
  name: 'whoami',
  description: 'Get information about the current user including role and permissions',
  inputSchema: {
    type: 'object',
    description: 'Options for the whoami command',
    properties: {
      includePermissions: {
        type: 'boolean',
        description: 'Include user permissions in the response',
        default: false
      },
      includeSession: {
        type: 'boolean',
        description: 'Include session information in the response',
        default: false
      }
    },
    additionalProperties: false
  },
  scope: 'all',
  metadata: {
    requiredRole: undefined,
    requiredPermissions: []
  },
  handler: async (params: any, context: any) => {
    const { includePermissions = false, includeSession = false } = params || {};
    
    // Mock implementation for demonstration
    const result: any = {
      message: `User: ${context.userEmail || 'user@example.com'} (${context.userId || 'anonymous'})`,
      result: {
        userId: context.userId || 'anonymous',
        email: context.userEmail || 'user@example.com',
        role: context.role || 'basic',
        isAdmin: context.role === 'admin'
      }
    };
    
    if (includePermissions) {
      result.result.permissions = context.permissions || ['read:own'];
    }
    
    if (includeSession) {
      result.result.session = {
        id: context.sessionId || 'local-session',
        isLocal: context.isLocal || false
      };
    }
    
    return result;
  }
};