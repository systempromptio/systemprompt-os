// Auto-generated database types for permissions module
// Generated on: 2025-07-28T19:59:56.311Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: permissions
 * Do not modify this file manually - it will be overwritten
 */
export interface IPermissionsRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: roles
 * Do not modify this file manually - it will be overwritten
 */
export interface IRolesRow {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: role_permissions
 * Do not modify this file manually - it will be overwritten
 */
export interface IRolePermissionsRow {
  role_id: string;
  permission_id: string;
  granted_at: string | null;
  granted_by: string | null;
}

/**
 * Generated from database table: user_roles
 * Do not modify this file manually - it will be overwritten
 */
export interface IUserRolesRow {
  user_id: string;
  role_id: string;
  assigned_at: string | null;
  assigned_by: string | null;
  expires_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type PermissionsDatabaseRow = IPermissionsRow | IRolesRow | IRolePermissionsRow | IUserRolesRow;

/**
 * Database table names for this module
 */
export const PERMISSIONS_TABLES = {
  PERMISSIONS: 'permissions',
  ROLES: 'roles',
  ROLEPERMISSIONS: 'role_permissions',
  USERROLES: 'user_roles',
} as const;
