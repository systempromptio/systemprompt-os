/**
 * Permissions type definitions.
 */

/**
 * Permission action enumeration.
 */
export const enum PermissionActionEnum {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage'
}

/**
 * Permission entity.
 */
export interface IPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role entity.
 */
export interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role permission mapping.
 */
export interface IRolePermission {
  roleId: string;
  permissionId: string;
  grantedAt: Date;
  grantedBy?: string;
}

/**
 * User role assignment.
 */
export interface IUserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy?: string;
  expiresAt?: Date;
}

/**
 * Permission check result.
 */
export interface IPermissionCheck {
  allowed: boolean;
  role?: string;
  permission?: string;
  reason?: string;
}

/**
 * Permissions service interface.
 */
export interface IPermissionsService {
  createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<IPermission>;
  getPermission(id: string): Promise<IPermission | null>;
  listPermissions(): Promise<IPermission[]>;
  createRole(name: string, description?: string): Promise<IRole>;
  getRole(id: string): Promise<IRole | null>;
  listRoles(): Promise<IRole[]>;
  grantPermission(roleId: string, permissionId: string): Promise<void>;
  revokePermission(roleId: string, permissionId: string): Promise<void>;
  assignRole(userId: string, roleId: string, expiresAt?: Date): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  checkPermission(userId: string, resource: string, action: string): Promise<IPermissionCheck>;
  getUserRoles(userId: string): Promise<IRole[]>;
  getRolePermissions(roleId: string): Promise<IPermission[]>;
}