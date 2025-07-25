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
