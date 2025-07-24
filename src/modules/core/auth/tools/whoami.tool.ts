/**

 * IToolDefinition interface.

 */

export interface IIToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (_input: unknown,_context: unknown) => Promise<unknown>;
}

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
  execute: async (_params: unknown,_context: unknown) => {
    const { includePermissions = false, includeSession = false } = params || {};

    const result: unknown = {
      message: `User: ${context.userEmail || 'user@example.com'} (${context.userId || 'anonymous'})`,
      result: {
        userId: context.userId || 'anonymous',
        email: context.userEmail || 'user@example.com',
        role: context.role || 'basic',
        isAdmin: context.role === 'admin'
      }
    };

    if (includePermissions)) {
      result.result.permissions = context.permissions || ['read:own'];
    }

    if (includeSession)) {
      result.result.session = {
        id: context.sessionId || 'local-session',
        isLocal: context.isLocal || false
      };
    }

    return result;
  }
};
