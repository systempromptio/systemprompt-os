// Auto-generated service schemas for auth module
// Generated on: 2025-08-01T10:34:43.921Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';

// Zod schema for AuthService
export const AuthServiceSchema = z.object({
  authenticate: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.unknown())),
  createSession: z.function()
    .args(z.string())
    .returns(z.promise(z.string())),
  validateSession: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  revokeSession: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  listSessions: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.string()))),
  listProviders: z.function()
    .args()
    .returns(z.promise(z.unknown())),
});

// Zod schema for IAuthModuleExports
export const AuthModuleExportsSchema = z.object({
  service: z.function().returns(AuthServiceSchema)
});

// Zod schema for complete module
export const AuthModuleSchema = createModuleSchema(AuthModuleExportsSchema).extend({
  name: z.literal('auth'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IAuthService = z.infer<typeof AuthServiceSchema>;
export type IAuthModuleExports = z.infer<typeof AuthModuleExportsSchema>;
