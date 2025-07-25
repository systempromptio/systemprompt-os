/**
 * @file MCP Tool request handlers with role-based permissions.
 * @module handlers/tool-handlers
 * @description
 * This module provides request handlers for MCP tool operations with a role-based
 * permission system. It handles tool listing and invocation, enforcing permissions
 * based on user roles (admin/basic) and granular permissions.
 * @example
 * ```typescript
 * // List available tools for a user session
 * const tools = await handleListTools({}, { sessionId: 'admin-123' });
 * // Call a tool with permission checking
 * const result = await handleToolCall({
 *   params: { name: 'checkstatus', arguments: {} }
 * }, { sessionId: 'admin-123' });
 * ```
 */

import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

import { getModuleLoader } from '@/modules/loader.js';
import { LoggerService } from '@/modules/core/logger/index.js';
import { LogSource } from '@/modules/core/logger/types/index.js';
import type { IMCPToolContext } from '@/server/mcp/core/types/request-context.js';
import { ROLE_PERMISSIONS, hasPermission } from '@/server/mcp/core/types/permissions.js';
import type { IUserPermissionContext, UserRole } from '@/server/mcp/core/types/permissions.js';

const logger = LoggerService.getInstance();

/**
 * Zod schema for validating user permission context.
 */
const UserPermissionContextSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'basic'] as const),
  permissions: z.array(z.string()),
  customPermissions: z.array(z.string()).optional(),
});

/**
 * Zod schema for tool metadata validation.
 */
const ToolMetadataSchema = z
  .object({
    requiredRole: z.enum(['admin', 'basic'] as const).optional(),
    requiredPermissions: z.array(z.string()).optional(),
  })
  .optional();

/**
 * Tool permission metadata interface.
 */
interface ToolPermissionMeta {
  requiredRole?: UserRole;
  requiredPermissions?: string[];
}

/**
 * Retrieves user permission context from session.
 * @param context - MCP tool context containing session information.
 * @returns Promise resolving to validated user permission context.
 * @throws {Error} If session is invalid or user context cannot be retrieved.
 * @remarks
 * In production, this should query the database for:
 * 1. Session validation
 * 2. User information
 * 3. Role assignments
 * 4. Custom permissions
 */
const getUserPermissionContext = async function (context: IMCPToolContext): Promise<IUserPermissionContext> {
  if (!context.sessionId) {
    throw new Error('Session ID is required');
  }

  const adminUserIds = ['113783121475955670750'];
  const isAdmin = context.userId && adminUserIds.includes(context.userId);
  const role: UserRole = isAdmin ? 'admin' : 'basic';

  const mockData = {
    userId: context.userId || 'anonymous',
    email: isAdmin ? 'admin@systemprompt.io' : 'user@systemprompt.io',
    role,
    permissions: ROLE_PERMISSIONS[role],
  };

  return UserPermissionContextSchema.parse(mockData) as IUserPermissionContext;
}

/**
 * Checks if a user has the required permissions to use a tool.
 * @param userContext - Validated user permission context.
 * @param metadata - Tool permission metadata.
 * @returns True if user has required permissions, false otherwise.
 * @remarks
 * Permission checking follows this hierarchy:
 * 1. If no metadata, tool is unrestricted
 * 2. Check role requirement if specified
 * 3. Check all required permissions
 * 4. Support wildcard permissions (e.g., admin:*)
 */
const hasToolPermission = function (
  userContext: IUserPermissionContext,
  metadata?: ToolPermissionMeta,
): boolean {
  const validatedMeta = ToolMetadataSchema.parse(metadata);

  if (!validatedMeta) {
    return true;
  }

  if (validatedMeta.requiredRole && userContext.role !== validatedMeta.requiredRole) {
    return false;
  }

  if (validatedMeta.requiredPermissions) {
    return validatedMeta.requiredPermissions.every((permission) => { return hasPermission(userContext, permission) },);
  }

  return true;
}

/**
 * Handles MCP tool listing requests with permission-based filtering.
 * @param request - Tool listing request (currently unused but kept for API compatibility).
 * @param _request
 * @param context - Optional MCP context containing session information.
 * @returns Promise resolving to list of tools the user can access.
 * @remarks
 * - Returns empty array if no context is provided
 * - Filters tools based on user's role and permissions
 * - Strips internal metadata from tool definitions
 * - Logs access patterns for security auditing
 */
export const handleListTools = async function (
  _request: ListToolsRequest,
  context?: IMCPToolContext,
): Promise<ListToolsResult> {
  try {
    logger.info(LogSource.MCP, 'Tool listing requested', {
      sessionId: context?.sessionId,
      requestId: randomUUID(),
    });

    if (!context) {
      logger.debug(LogSource.MCP, 'No context provided, returning empty tool list');
      return { tools: [] };
    }

    const userContext = await getUserPermissionContext(context);

    logger.info(LogSource.MCP, 'User permission context retrieved', {
      userId: userContext.userId,
      role: userContext.role,
      permissionCount: userContext.permissions.length,
    });

    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const toolsModule = moduleLoader.getModule('tools');

    if (!toolsModule?.exports) {
      logger.error(LogSource.MCP, 'Tools module not available');
      return { tools: [] };
    }

    const enabledTools = await toolsModule.exports.getEnabledToolsByScope('remote');

    const availableTools = enabledTools.filter((tool: unknown) => {
      const metadata = (tool as any).metadata as ToolPermissionMeta | undefined;
      return hasToolPermission(userContext, metadata);
    });

    logger.info(LogSource.MCP, 'Tool filtering completed', {
      userId: userContext.userId,
      role: userContext.role,
      totalTools: enabledTools.length,
      availableTools: availableTools.length,
      toolNames: availableTools.map((t: unknown) => { return (t as any).name }),
    });

    return { tools: availableTools };
  } catch (error) {
    logger.error(LogSource.MCP, 'Tool listing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Handles MCP tool invocation requests with permission enforcement.
 * @param request - Tool call request containing tool name and arguments.
 * @param context - MCP context containing session information.
 * @returns Promise resolving to tool execution result.
 * @throws {Error} If tool is unknown, user lacks permissions, or execution fails.
 * @remarks
 * - Validates tool existence in registry
 * - Enforces role-based and granular permissions
 * - Logs all access attempts for security auditing
 * - Provides detailed error messages for debugging
 */
export const handleToolCall = async function (
  request: CallToolRequest,
  context: IMCPToolContext,
): Promise<CallToolResult> {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    const { name: toolName, arguments: toolArgs } = request.params;

    logger.info(LogSource.MCP, 'Tool call initiated', {
      toolName,
      sessionId: context.sessionId,
      requestId,
      hasArguments: toolArgs !== undefined,
    });

    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const toolsModule = moduleLoader.getModule('tools');

    if (!toolsModule?.exports) {
      const error = new Error('Tools module not available');
      logger.error(LogSource.MCP, 'Tools module not loaded', { requestId });
      throw error;
    }

    const tool = await toolsModule.exports.getTool(toolName);
    if (!tool) {
      const error = new Error(`Unknown tool: ${toolName}`);
      logger.error(LogSource.MCP, 'Tool not found in registry', {
        toolName,
        requestId,
      });
      throw error;
    }

    const userContext = await getUserPermissionContext(context);

    const metadata = tool.metadata as ToolPermissionMeta | undefined;
    if (!hasToolPermission(userContext, metadata)) {
      const error = new Error(
        `Permission denied: ${userContext.role} role cannot access ${toolName} tool`,
      );

      logger.warn(LogSource.MCP, 'Tool access denied', {
        userId: userContext.userId,
        userEmail: userContext.email,
        role: userContext.role,
        toolName,
        requiredRole: metadata?.requiredRole,
        requiredPermissions: metadata?.requiredPermissions,
        userPermissions: userContext.permissions,
        requestId,
      });

      throw error;
    }

    logger.info(LogSource.MCP, 'Tool execution started', {
      userId: userContext.userId,
      userEmail: userContext.email,
      role: userContext.role,
      toolName,
      requestId,
    });

    const result = await toolsModule.exports.executeTool(toolName, toolArgs, {
      userId: userContext.userId,
      userEmail: userContext.email,
      sessionId: context.sessionId,
      requestId,
    });

    const executionTime = Date.now() - startTime;

    logger.info(LogSource.MCP, 'Tool execution completed', {
      userId: userContext.userId,
      toolName,
      executionTime,
      requestId,
    });

    const mcpResult: CallToolResult = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };

    return mcpResult;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isPermissionError = errorMessage.includes('Permission denied');

    logger.error(LogSource.MCP, 'Tool execution failed', {
      toolName: request.params.name,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      executionTime,
      requestId,
      isPermissionError,
    });

    throw error;
  }
}
