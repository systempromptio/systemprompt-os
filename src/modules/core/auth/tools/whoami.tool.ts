import type {
  IToolContext,
  IToolDefinition,
  IToolResult,
  IWhoamiParams,
  IWhoamiResult
} from '@/modules/core/auth/types/tool.types';

/**
 * Type guard for IWhoamiParams.
 * @param value - Value to check.
 * @returns True if value is IWhoamiParams.
 */
const isWhoamiParams = (value: unknown): value is IWhoamiParams => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const obj = value as { [key: string]: unknown };

  if ('includePermissions' in obj && typeof obj.includePermissions !== 'boolean') {
    return false;
  }

  if ('includeSession' in obj && typeof obj.includeSession !== 'boolean') {
    return false;
  }

  return true;
};

/**
 * Type guard for IToolContext.
 * @param value - Value to check.
 * @returns True if value is IToolContext.
 */
const isToolContext = (value: unknown): value is IToolContext => {
  return value !== null && typeof value === 'object';
};

/**
 * Builds the base user information.
 * @param ctx - Tool execution context.
 * @returns Base user information.
 */
const buildBaseUserInfo = (ctx: IToolContext): Omit<IWhoamiResult, 'permissions' | 'session'> => {
  const userEmail = ctx.userEmail ?? 'user@example.com';
  const userId = ctx.userId ?? 'anonymous';
  const role = ctx.role ?? 'basic';

  return {
    userId,
    email: userEmail,
    role,
    isAdmin: role === 'admin'
  };
};

/**
 * Builds the complete whoami result.
 * @param ctx - Tool execution context.
 * @param input - Input parameters.
 * @returns Complete whoami result.
 */
const buildWhoamiResult = (
  ctx: IToolContext,
  input: IWhoamiParams | undefined
): IWhoamiResult => {
  const result: IWhoamiResult = buildBaseUserInfo(ctx);

  if (input?.includePermissions === true) {
    result.permissions = ctx.permissions ?? ['read:own'];
  }

  if (input?.includeSession === true) {
    result.session = {
      id: ctx.sessionId ?? 'local-session',
      isLocal: ctx.isLocal ?? false
    };
  }

  return result;
};

/**
 * Whoami tool definition.
 * Provides information about the current authenticated user.
 */
export const tool: IToolDefinition = {
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
  /**
   * Executes the whoami command and returns user information.
   * @param params - Input parameters for the whoami command.
   * @param context - Execution context with user information.
   * @returns Promise resolving to user information response.
   */
  execute: async (params: unknown, context: unknown): Promise<IToolResult> => {
    const input = isWhoamiParams(params) ? params : undefined;
    const ctx = isToolContext(context) ? context : {};

    const whoamiResult = buildWhoamiResult(ctx, input);

    return await Promise.resolve({
      message: `User: ${whoamiResult.email} (${whoamiResult.userId})`,
      result: whoamiResult
    });
  }
};
