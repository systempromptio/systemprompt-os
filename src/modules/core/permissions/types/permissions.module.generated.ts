// Auto-generated Zod schemas for permissions module
// Generated on: 2025-08-01T14:31:11.108Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { 
  PermissionsRowSchema, 
  RolesRowSchema, 
  UserRolesRowSchema,
  RolePermissionsRowSchema 
} from './database.generated';

// Permission schema - directly use database row schema
export const PermissionSchema = PermissionsRowSchema;

export const PermissionCreateDataSchema = z.object({
  name: z.string(),
  resource: z.string(),
  action: z.string(),
  description: z.string().nullable(),
});

export const PermissionUpdateDataSchema = z.object({
  name: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  description: z.string().nullable().optional(),
});

// Role schema - directly use database row schema
export const RoleSchema = RolesRowSchema;

export const RoleCreateDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean().default(false),
});

export const RoleUpdateDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  is_system: z.boolean().optional(),
});

// User role schema - directly use database row schema
export const UserRoleSchema = UserRolesRowSchema;

// Role permission schema - directly use database row schema
export const RolePermissionSchema = RolePermissionsRowSchema;

// Type inference from schemas
export type Permission = z.infer<typeof PermissionSchema>;
export type PermissionCreateData = z.infer<typeof PermissionCreateDataSchema>;
export type PermissionUpdateData = z.infer<typeof PermissionUpdateDataSchema>;

export type Role = z.infer<typeof RoleSchema>;
export type RoleCreateData = z.infer<typeof RoleCreateDataSchema>;
export type RoleUpdateData = z.infer<typeof RoleUpdateDataSchema>;

export type UserRole = z.infer<typeof UserRoleSchema>;
export type RolePermission = z.infer<typeof RolePermissionSchema>;

// Domain type aliases for easier imports
export type IPermission = Permission;
export type IPermissionCreateData = PermissionCreateData;
export type IPermissionUpdateData = PermissionUpdateData;

export type IRole = Role;
export type IRoleCreateData = RoleCreateData;
export type IRoleUpdateData = RoleUpdateData;

export type IUserRole = UserRole;
export type IRolePermission = RolePermission;
