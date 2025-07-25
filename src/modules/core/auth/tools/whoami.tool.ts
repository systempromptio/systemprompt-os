/**
 *
 * IToolDefinition interface.
 *
 */

export interface IToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (_input: unknown,_context: unknown) => Promise<unknown>;
}

type ToolDefinition = IToolDefinition;

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
  execute: async (params: unknown, context: unknown) => {
    const { includePermissions = false, includeSession = false } = (params as any) || {};

    const result: any = {
      message: `User: ${(context as any)?.userEmail || 'user@example.com'} (${(context as any)?.userId || 'anonymous'})`,
      result: {
        userId: (context as any)?.userId || 'anonymous',
        email: (context as any)?.userEmail || 'user@example.com',
        role: (context as any)?.role || 'basic',
        isAdmin: (context as any)?.role === 'admin'
      }
    };

    if (includePermissions) {
      result.result.permissions = (context as any)?.permissions || ['read:own'];
    }

    if (includeSession) {
      result.result.session = {
        id: (context as any)?.sessionId || 'local-session',
        isLocal: (context as any)?.isLocal || false
      };
    }

    return result;
  }
};
