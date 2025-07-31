// Auto-generated service schemas for database module
// Generated on: 2025-07-31T13:04:43.707Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';

// Zod schema for DatabaseService
export const DatabaseServiceSchema = z.object({
  getConnection: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  query: z.function()
    .args(z.string(), z.array(z.unknown()))
    .returns(z.promise(z.array(z.unknown()))),
  execute: z.function()
    .args(z.string(), z.array(z.unknown()))
    .returns(z.promise(z.any())),
  prepare: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  transaction: z.function()
    .args(z.unknown())
    .returns(z.promise(z.unknown())),
  disconnect: z.function()
    .args()
    .returns(z.promise(z.void())),
  reset: z.function()
    .args()
    .returns(z.promise(z.void())),
  getDatabaseType: z.function()
    .args()
    .returns(z.unknown()),
  isConnected: z.function()
    .args()
    .returns(z.boolean()),
  isInitialized: z.function()
    .args()
    .returns(z.promise(z.boolean())),
});

// Zod schema for IDatabaseModuleExports
export const DatabaseModuleExportsSchema = z.object({
  service: z.function().returns(DatabaseServiceSchema)
});

// Zod schema for complete module
export const DatabaseModuleSchema = createModuleSchema(DatabaseModuleExportsSchema).extend({
  name: z.literal('database'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IDatabaseService = z.infer<typeof DatabaseServiceSchema>;
export type IDatabaseModuleExports = z.infer<typeof DatabaseModuleExportsSchema>;
