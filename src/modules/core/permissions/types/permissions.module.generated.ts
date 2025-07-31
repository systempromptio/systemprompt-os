// Auto-generated Zod schemas for permissions module
// Generated on: 2025-07-31T11:41:30.548Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { PermissionsRowSchema } from './database.generated';

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

// Type inference from schemas
export type Permission = z.infer<typeof PermissionSchema>;
export type PermissionCreateData = z.infer<typeof PermissionCreateDataSchema>;
export type PermissionUpdateData = z.infer<typeof PermissionUpdateDataSchema>;

// Domain type aliases for easier imports
export type IPermission = Permission;
export type IPermissionCreateData = PermissionCreateData;
export type IPermissionUpdateData = PermissionUpdateData;
