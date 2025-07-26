/**
 * @file Type definitions for MCP tool handlers.
 * @module types/tool
 */

import type { UserRole } from '@/server/mcp/core/types/permissions';

/**
 * Tool permission metadata interface.
 */
export interface IToolPermissionMeta {
  requiredRole?: UserRole;
  requiredPermissions?: string[];
}

/**
 * Tool with metadata interface.
 */
export interface IToolWithMetadata {
  metadata?: IToolPermissionMeta;
  name: string;
}

/**
 * Tools module exports for listing tools.
 */
export interface IToolsListModuleExports {
  getEnabledToolsByScope: (scope: string) => Promise<unknown[]>;
}

/**
 * Tools module exports for executing tools.
 */
export interface IToolsExecuteModuleExports {
  getTool: (name: string) => Promise<{ metadata?: IToolPermissionMeta } | null>;
  executeTool: (name: string, args: unknown, ctx: {
    userId: string;
    userEmail: string;
    sessionId: string;
    requestId: string;
  }) => Promise<unknown>;
}
