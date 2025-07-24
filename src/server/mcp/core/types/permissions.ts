/**
 * Permission types for MCP tool access control.
 */

export type UserRole = 'admin' | 'basic';

export type Permission = string;

export interface UserPermissionContext {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  customPermissions?: Permission[];
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'admin:*',
    'tools:*',
    'resources:*',
    'prompts:*',
    'system:*'
  ],
  basic: [
    'tools:read',
    'tools:execute:basic',
    'resources:read',
    'prompts:read',
    'prompts:execute'
  ]
};

/**
 * Check if a user has a specific permission.
 * @param userContext
 * @param permission
 */
export function hasPermission(
  userContext: UserPermissionContext,
  permission: string
): boolean {
  const allPermissions = [
    ...userContext.permissions,
    ...userContext.customPermissions || []
  ];

  // Check for exact match
  if (allPermissions.includes(permission)) {
    return true;
  }

  // Check for wildcard permissions
  const permissionParts = permission.split(':');
  for (const userPerm of allPermissions) {
    const userPermParts = userPerm.split(':');

    // Check if user has a wildcard that matches
    if (userPermParts[userPermParts.length - 1] === '*') {
      const wildcardBase = userPermParts.slice(0, -1).join(':');
      const permissionBase = permissionParts.slice(0, userPermParts.length - 1).join(':');

      if (wildcardBase === permissionBase) {
        return true;
      }
    }
  }

  return false;
}
