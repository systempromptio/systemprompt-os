/**
 * @file Whoami tool handler for retrieving current user information.
 * @module handlers/tools/whoami
 */

import type {
  CallToolResult,
  IToolHandlerContext,
  ToolHandler,
} from '@/server/mcp/core/handlers/tools/types.js';
import { formatToolResponse } from '@/server/mcp/core/handlers/tools/types.js';
import { LogSource, LoggerService } from '@/modules/core/logger/index.js';
import type { IMCPToolContext } from '@/server/mcp/core/types/request-context.js';
import type { IUserPermissionContext } from '@/server/mcp/core/types/permissions.js';
import { ROLE_PERMISSIONS } from '@/server/mcp/core/types/permissions.js';

const logger = LoggerService.getInstance();

/**
 * Whoami tool arguments.
 */
interface WhoamiArgs {
  includePermissions?: boolean;
  includeSession?: boolean;
}

/**
 * Whoami response structure.
 */
interface WhoamiResponse {
  userId: string;
  email: string;
  role: string;
  isAdmin: boolean;
  permissions?: string[];
  customPermissions?: string[];
  session?: {
    sessionId: string;
    createdAt: string;
  };
}

/**
 * Get user permission context (imported from tool-handlers.ts logic).
 * @param context
 */
const getUserContext = async function (context: IMCPToolContext): Promise<IUserPermissionContext> {
  if (!context.sessionId) {
    throw new Error('Session ID is required');
  }

  const adminUserIds = ['113783121475955670750'];
  const isAdmin = context.userId && adminUserIds.includes(context.userId);
  const role = isAdmin ? 'admin' : 'basic';

  return {
    userId: context.userId || 'anonymous',
    email: isAdmin ? 'admin@systemprompt.io' : 'user@systemprompt.io',
    role,
    permissions: ROLE_PERMISSIONS[role],
    customPermissions: [],
  };
};

/**
 * Whoami tool handler accessible to all authenticated users.
 * @param args
 * @param context
 */
export const handleWhoami: ToolHandler<WhoamiArgs | undefined> = async (
  args: WhoamiArgs | undefined,
  context?: IToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info(LogSource.MCP, 'Whoami tool invoked', {
      sessionId: context?.sessionId,
      userId: context?.userId,
      includePermissions: args?.includePermissions,
      includeSession: args?.includeSession,
    });

    if (!context) {
      throw new Error('Authentication context is required');
    }

    const userContext = await getUserContext(context as IMCPToolContext);

    const response: WhoamiResponse = {
      userId: userContext.userId,
      email: userContext.email,
      role: userContext.role,
      isAdmin: userContext.role === 'admin',
    };

    if (args?.includePermissions) {
      response.permissions = userContext.permissions;
      if (userContext.customPermissions && userContext.customPermissions.length > 0) {
        response.customPermissions = userContext.customPermissions;
      }
    }

    if (args?.includeSession && context.sessionId) {
      response.session = {
        sessionId: context.sessionId,
        createdAt: new Date().toISOString(),
      };
    }

    logger.info(LogSource.MCP, 'Whoami tool completed', {
      sessionId: context?.sessionId,
      userId: userContext.userId,
      data: {
        role: userContext.role,
        includePermissions: Boolean(response.permissions),
        includeSession: Boolean(response.session),
      },
    });

    return formatToolResponse({
      message: `User: ${userContext.email} (${userContext.role})`,
      result: response,
    });
  } catch (error) {
    logger.error(LogSource.MCP, 'Failed to get user information', {
      error: error instanceof Error ? error : String(error),
      sessionId: context?.sessionId,
      data: { args },
    });

    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get user information',
      error: {
        type: 'whoamierror',
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};
