// Auto-generated service schemas for dev module
// Generated on: 2025-08-01T13:49:50.970Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';

// Zod schema for DevService
export const DevServiceSchema = z.object({
  createProfile: z.function()
    .args(z.string(), z.string(), z.unknown())
    .returns(z.promise(z.unknown())),
  getProfile: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown().nullable())),
  startSession: z.function()
    .args(z.unknown(), z.number())
    .returns(z.promise(z.unknown())),
  endSession: z.function()
    .args(z.number(), z.unknown(), z.unknown())
    .returns(z.promise(z.void())),
  getAllProfiles: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  updateProfile: z.function()
    .args(z.number(), z.unknown())
    .returns(z.promise(z.unknown())),
  deleteProfile: z.function()
    .args(z.number())
    .returns(z.promise(z.void())),
  getActiveSessions: z.function()
    .args(z.number())
    .returns(z.promise(z.array(z.unknown()))),
  getAllSessions: z.function()
    .args(z.number())
    .returns(z.promise(z.array(z.unknown()))),
  getSessionStats: z.function()
    .args(z.number())
    .returns(z.promise(z.unknown())),
  generateTypes: z.function()
    .args(z.unknown())
    .returns(z.promise(z.void())),
  getRulesSyncService: z.function()
    .args()
    .returns(z.unknown()),
});

// Zod schema for IDevModuleExports
export const DevModuleExportsSchema = z.object({
  service: z.function().returns(DevServiceSchema)
});

// Zod schema for complete module
export const DevModuleSchema = createModuleSchema(DevModuleExportsSchema).extend({
  name: z.literal('dev'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IDevService = z.infer<typeof DevServiceSchema>;
export type IDevModuleExports = z.infer<typeof DevModuleExportsSchema>;
