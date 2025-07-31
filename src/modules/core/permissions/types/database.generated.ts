// Auto-generated database types for permissions module
// Generated on: 2025-07-31T14:59:32.164Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for database row validation
export const PermissionsRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.string(),
  action: z.string(),
  description: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const RolesRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const RolePermissionsRowSchema = z.object({
  role_id: z.string(),
  permission_id: z.string(),
  granted_at: z.string().datetime().nullable(),
  granted_by: z.string().nullable(),
});

export const UserRolesRowSchema = z.object({
  user_id: z.string(),
  role_id: z.string(),
  assigned_at: z.string().datetime().nullable(),
  assigned_by: z.string().nullable(),
  expires_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type PermissionsDatabaseRow = IPermissionsRow | IRolesRow | IRolePermissionsRow | IUserRolesRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const PermissionsDatabaseRowSchema = z.union([PermissionsRowSchema, RolesRowSchema, RolePermissionsRowSchema, UserRolesRowSchema]);

/**
 * Database table names for this module
 */
export const PERMISSIONS_TABLES = {
  PERMISSIONS: 'permissions',
  ROLES: 'roles',
  ROLE_PERMISSIONS: 'role_permissions',
  USER_ROLES: 'user_roles',
} as const;
