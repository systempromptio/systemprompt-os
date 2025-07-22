/**
 * @fileoverview Permission system types for MCP tools
 * @module types/permissions
 */

/**
 * User roles in the system
 */
export type UserRole = 'admin' | 'basic';

/**
 * Permission format: resource:action
 * Examples:
 * - system:read - Read system status
 * - admin:status - Access admin status
 * - admin:* - All admin permissions
 * - container:create - Create containers
 * - container:* - All container permissions
 */
export type Permission = string;

/**
 * Role definitions with their default permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'system:read',
    'system:write',
    'admin:*',
    'container:*',
    'user:*',
    'audit:read',
    'tools:*'
  ],
  basic: [
    'system:read:basic',
    'container:read:own',
    'user:read:self',
    'tools:basic'
  ]
};

/**
 * User permission context
 */
export interface UserPermissionContext {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  customPermissions?: Permission[]; // Additional permissions beyond role defaults
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  context: UserPermissionContext,
  required: Permission
): boolean {
  const allPermissions = [
    ...context.permissions,
    ...(context.customPermissions || [])
  ];
  
  // Check exact match
  if (allPermissions.includes(required)) {
    return true;
  }
  
  // Check wildcard permissions
  const [resource] = required.split(':');
  
  // Check resource:* permission
  if (allPermissions.includes(`${resource}:*`)) {
    return true;
  }
  
  // Check *:* permission (super admin)
  if (allPermissions.includes('*:*')) {
    return true;
  }
  
  return false;
}

/**
 * Database schema for roles and permissions
 */
export interface RoleSchema {
  id: string;
  name: UserRole;
  description: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleSchema {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
}

export interface UserPermissionSchema {
  userId: string;
  permission: Permission;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  reason?: string;
}