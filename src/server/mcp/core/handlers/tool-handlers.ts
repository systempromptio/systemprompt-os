/**
 * @fileoverview MCP Tool request handlers with role-based permissions
 * @module handlers/tool-handlers
 * 
 * @description
 * This module provides request handlers for MCP tool operations with a role-based
 * permission system. It handles tool listing and invocation, enforcing permissions
 * based on user roles (admin/basic) and granular permissions.
 * 
 * @example
 * ```typescript
 * // List available tools for a user session
 * const tools = await handleListTools({}, { sessionId: 'admin-123' });
 * 
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
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { checkStatus } from "../constants/tool/check-status.js";
import { handleCheckStatus } from "./tools/check-status.js";
import { logger } from "@/utils/logger.js";
import type { MCPToolContext } from "../types/request-context.js";
import type { PermissionTool } from "../constants/tool/check-status.js";
import { ROLE_PERMISSIONS, hasPermission } from "../types/permissions.js";
import type { UserRole, Permission, UserPermissionContext } from "../types/permissions.js";

/**
 * Zod schema for validating user permission context
 */
const UserPermissionContextSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'basic'] as const),
  permissions: z.array(z.string()),
  customPermissions: z.array(z.string()).optional()
});

/**
 * Zod schema for tool metadata validation
 */
const ToolMetadataSchema = z.object({
  requiredRole: z.enum(['admin', 'basic'] as const).optional(),
  requiredPermissions: z.array(z.string()).optional()
}).optional();


/**
 * Registry of available MCP tools
 */
const TOOL_REGISTRY: ReadonlyArray<PermissionTool> = Object.freeze([checkStatus]);

/**
 * Tool handler function map
 */
const TOOL_HANDLERS = Object.freeze({
  checkstatus: handleCheckStatus
} as const);

/**
 * Retrieves user permission context from session
 * 
 * @param context - MCP tool context containing session information
 * @returns Promise resolving to validated user permission context
 * @throws {Error} If session is invalid or user context cannot be retrieved
 * 
 * @remarks
 * In production, this should query the database for:
 * 1. Session validation
 * 2. User information
 * 3. Role assignments
 * 4. Custom permissions
 */
async function getUserPermissionContext(context: MCPToolContext): Promise<UserPermissionContext> {
  if (!context.sessionId) {
    throw new Error('Session ID is required');
  }

  // Check if user is admin based on their Google user ID
  // Your Google user ID: 113783121475955670750
  const adminUserIds = ['113783121475955670750'];
  const isAdmin = context.userId && adminUserIds.includes(context.userId);
  const role: UserRole = isAdmin ? 'admin' : 'basic';
  
  const mockData = {
    userId: context.userId || 'anonymous',
    email: isAdmin ? 'admin@systemprompt.io' : 'user@systemprompt.io',
    role,
    permissions: ROLE_PERMISSIONS[role],
    customPermissions: []
  };

  return UserPermissionContextSchema.parse(mockData);
}

/**
 * Checks if a user has the required permissions to use a tool
 * 
 * @param userContext - Validated user permission context
 * @param tool - Tool with permission metadata
 * @returns true if user has required permissions, false otherwise
 * 
 * @remarks
 * Permission checking follows this hierarchy:
 * 1. If no metadata, tool is unrestricted
 * 2. Check role requirement if specified
 * 3. Check all required permissions
 * 4. Support wildcard permissions (e.g., admin:*)
 */
function hasToolPermission(
  userContext: UserPermissionContext,
  tool: PermissionTool
): boolean {
  const validatedMeta = ToolMetadataSchema.parse(tool._meta);
  
  if (!validatedMeta) {
    return true;
  }

  if (validatedMeta.requiredRole && userContext.role !== validatedMeta.requiredRole) {
    return false;
  }

  if (validatedMeta.requiredPermissions) {
    return validatedMeta.requiredPermissions.every(permission =>
      hasPermission(userContext, permission as Permission)
    );
  }

  return true;
}

/**
 * Strips internal metadata from a tool for public API response
 * 
 * @param tool - Tool with potential internal metadata
 * @returns Tool without _meta property
 */
function stripToolMetadata(tool: PermissionTool): Tool {
  const { _meta, ...publicTool } = tool;
  return publicTool;
}

/**
 * Handles MCP tool listing requests with permission-based filtering
 * 
 * @param request - Tool listing request (currently unused but kept for API compatibility)
 * @param context - Optional MCP context containing session information
 * @returns Promise resolving to list of tools the user can access
 * 
 * @remarks
 * - Returns empty array if no context is provided
 * - Filters tools based on user's role and permissions
 * - Strips internal metadata from tool definitions
 * - Logs access patterns for security auditing
 */
export async function handleListTools(
  _request: ListToolsRequest,
  context?: MCPToolContext
): Promise<ListToolsResult> {
  try {
    logger.info('Tool listing requested', { 
      sessionId: context?.sessionId,
      requestId: randomUUID()
    });

    if (!context) {
      logger.debug('No context provided, returning empty tool list');
      return { tools: [] };
    }

    const userContext = await getUserPermissionContext(context);
    
    logger.info('User permission context retrieved', {
      userId: userContext.userId,
      role: userContext.role,
      permissionCount: userContext.permissions.length
    });

    const availableTools = TOOL_REGISTRY
      .filter(tool => hasToolPermission(userContext, tool))
      .map(stripToolMetadata);

    logger.info('Tool filtering completed', {
      userId: userContext.userId,
      role: userContext.role,
      totalTools: TOOL_REGISTRY.length,
      availableTools: availableTools.length,
      toolNames: availableTools.map(t => t.name)
    });

    return { tools: availableTools };
  } catch (error) {
    logger.error('Tool listing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Tool call arguments schema
 */
const ToolCallArgsSchema = z.record(z.unknown()).optional();

/**
 * Handles MCP tool invocation requests with permission enforcement
 * 
 * @param request - Tool call request containing tool name and arguments
 * @param context - MCP context containing session information
 * @returns Promise resolving to tool execution result
 * @throws {Error} If tool is unknown, user lacks permissions, or execution fails
 * 
 * @remarks
 * - Validates tool existence in registry
 * - Enforces role-based and granular permissions
 * - Logs all access attempts for security auditing
 * - Provides detailed error messages for debugging
 */
export async function handleToolCall(
  request: CallToolRequest,
  context: MCPToolContext
): Promise<CallToolResult> {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    const { name: toolName, arguments: toolArgs } = request.params;
    
    logger.info('Tool call initiated', {
      toolName,
      sessionId: context.sessionId,
      requestId,
      hasArguments: toolArgs !== undefined
    });

    const tool = TOOL_REGISTRY.find(t => t.name === toolName);
    if (!tool) {
      const error = new Error(`Unknown tool: ${toolName}`);
      logger.error('Tool not found in registry', {
        toolName,
        availableTools: TOOL_REGISTRY.map(t => t.name),
        requestId
      });
      throw error;
    }

    const userContext = await getUserPermissionContext(context);
    
    if (!hasToolPermission(userContext, tool)) {
      const error = new Error(
        `Permission denied: ${userContext.role} role cannot access ${toolName} tool`
      );
      
      logger.warn('Tool access denied', {
        userId: userContext.userId,
        userEmail: userContext.email,
        role: userContext.role,
        toolName,
        requiredRole: tool._meta?.requiredRole,
        requiredPermissions: tool._meta?.requiredPermissions,
        userPermissions: userContext.permissions,
        requestId
      });
      
      throw error;
    }

    const handler = TOOL_HANDLERS[toolName as keyof typeof TOOL_HANDLERS];
    if (!handler) {
      const error = new Error(`No handler implemented for tool: ${toolName}`);
      logger.error('Tool handler missing', { toolName, requestId });
      throw error;
    }

    logger.info('Tool execution started', {
      userId: userContext.userId,
      userEmail: userContext.email,
      role: userContext.role,
      toolName,
      requestId
    });

    const validatedArgs = ToolCallArgsSchema.parse(toolArgs);
    const result = await handler(validatedArgs || {}, context);

    const executionTime = Date.now() - startTime;
    
    logger.info('Tool execution completed', {
      userId: userContext.userId,
      toolName,
      executionTime,
      requestId,
      resultStatus: result?.structuredContent?.status || 'success'
    });

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isPermissionError = errorMessage.includes('Permission denied');

    logger.error('Tool execution failed', {
      toolName: request.params.name,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      executionTime,
      requestId,
      isPermissionError
    });

    throw error;
  }
}