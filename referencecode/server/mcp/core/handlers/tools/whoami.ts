/**
 * @fileoverview Whoami tool handler for retrieving current user information
 * @module handlers/tools/whoami
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import type { Logger } from '@/modules/core/logger/index.js';
import type { MCPToolContext } from '../../types/request-context.js';
import type { UserPermissionContext } from '../../types/permissions.js';
import { ROLE_PERMISSIONS } from '../../types/permissions.js';

/**
 * Whoami tool arguments
 */
interface WhoamiArgs {
  includePermissions?: boolean;
  includeSession?: boolean;
}

/**
 * Whoami response structure
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
 * Get user permission context (imported from tool-handlers.ts logic)
 */
async function getUserContext(context: MCPToolContext): Promise<UserPermissionContext> {
  if (!context.sessionId) {
    throw new Error('Session ID is required');
  }

  // Check if user is admin based on their Google user ID
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
}

/**
 * Whoami tool handler accessible to all authenticated users
 */
export const handleWhoami: ToolHandler<WhoamiArgs | undefined> = async (
  args: WhoamiArgs | undefined,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info('Whoami tool invoked', {
      sessionId: context?.sessionId,
      userId: context?.userId,
      includePermissions: args?.includePermissions,
      includeSession: args?.includeSession,
    });

    if (!context) {
      throw new Error('Authentication context is required');
    }

    // Get user context
    const userContext = await getUserContext(context as MCPToolContext);

    // Build response
    const response: WhoamiResponse = {
      userId: userContext.userId,
      email: userContext.email,
      role: userContext.role,
      isAdmin: userContext.role === 'admin',
    };

    // Add permissions if requested
    if (args?.includePermissions) {
      response.permissions = userContext.permissions;
      if (userContext.customPermissions && userContext.customPermissions.length > 0) {
        response.customPermissions = userContext.customPermissions;
      }
    }

    // Add session info if requested
    if (args?.includeSession && context.sessionId) {
      response.session = {
        sessionId: context.sessionId,
        createdAt: new Date().toISOString(), // In production, this would come from session storage
      };
    }

    logger.info('Whoami tool completed', {
      sessionId: context?.sessionId,
      userId: userContext.userId,
      role: userContext.role,
      includePermissions: !!response.permissions,
      includeSession: !!response.session,
    });

    return formatToolResponse({
      message: `User: ${userContext.email} (${userContext.role})`,
      result: response,
    });
  } catch (error) {
    logger.error('Failed to get user information', {
      error,
      args,
      sessionId: context?.sessionId,
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
