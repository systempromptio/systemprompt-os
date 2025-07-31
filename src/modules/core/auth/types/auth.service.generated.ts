// Auto-generated service schemas for auth module
// Generated on: 2025-07-31T11:41:33.485Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';
import { AuthSchema, AuthCreateDataSchema, AuthUpdateDataSchema } from './auth.module.generated';

// Zod schema for AuthService
export const AuthServiceSchema = z.object({
  login: z.function()
    .args(z.unknown())
    .returns(z.promise(z.unknown())),
  logout: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  refreshAccessToken: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  validateSession: z.function()
    .args(z.string())
    .returns(z.promise(z.string().nullable())),
  createApiToken: z.function()
    .args(z.unknown())
    .returns(z.promise(z.unknown())),
  validateApiToken: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  listUserTokens: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.unknown()))),
  revokeToken: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  revokeUserTokens: z.function()
    .args(z.string(), z.string())
    .returns(z.promise(z.void())),
  cleanupExpiredTokens: z.function()
    .args()
    .returns(z.promise(z.number())),
  createOrUpdateUserFromOAuth: z.function()
    .args(z.string(), z.string(), z.unknown())
    .returns(z.promise(z.unknown().nullable())),
  requestUserData: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown().nullable())),
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
