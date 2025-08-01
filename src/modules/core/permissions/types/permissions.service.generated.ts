// Auto-generated service schemas for permissions module
// Generated on: 2025-08-01T13:49:53.113Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';
import { PermissionSchema } from './permissions.module.generated';

// Zod schema for PermissionsService
export const PermissionsServiceSchema = z.object({
  createPermission: z.function()
    .args(z.string(), z.string(), z.string(), z.string())
    .returns(z.promise(PermissionSchema)),
  getPermission: z.function()
    .args(z.string())
    .returns(z.promise(PermissionSchema.nullable())),
  listPermissions: z.function()
    .args()
    .returns(z.promise(z.array(PermissionSchema))),
  createRole: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.unknown())),
  getRole: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown().nullable())),
  listRoles: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  grantPermission: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.void())),
  revokePermission: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.void())),
  assignRole: z.function()
    .args(z.string(), z.string(), z.unknown())
    .returns(z.promise(z.void())),
  removeRole: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.void())),
  checkPermission: z.function()
    .args(z.string(), z.string(), z.string())
    .returns(z.promise(z.unknown())),
  getUserRoles: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.unknown()))),
  getRolePermissions: z.function()
    .args(z.string())
    .returns(z.promise(z.array(PermissionSchema))),
});

// Zod schema for IPermissionsModuleExports
export const PermissionsModuleExportsSchema = z.object({
  service: z.function().returns(PermissionsServiceSchema)
});

// Zod schema for complete module
export const PermissionsModuleSchema = createModuleSchema(PermissionsModuleExportsSchema).extend({
  name: z.literal('permissions'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IPermissionsService = z.infer<typeof PermissionsServiceSchema>;
export type IPermissionsModuleExports = z.infer<typeof PermissionsModuleExportsSchema>;
