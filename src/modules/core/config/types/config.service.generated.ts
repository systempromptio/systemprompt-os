// Auto-generated service schemas for config module
// Generated on: 2025-07-31T14:59:46.748Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';

// Zod schema for ConfigService
export const ConfigServiceSchema = z.object({
  get: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown())),
  set: z.function()
    .args(z.string(), z.unknown())
    .returns(z.promise(z.void())),
  delete: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  list: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  validate: z.function()
    .args()
    .returns(z.promise(z.unknown())),
  addMcpServer: z.function()
    .args(z.unknown())
    .returns(z.promise(z.void())),
  deleteMcpServer: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  getMcpServer: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown().nullable())),
  listMcpServers: z.function()
    .args()
    .returns(z.promise(z.array(z.unknown()))),
  updateMcpServerStatus: z.function()
    .args(z.string(), z.string(), z.string())
    .returns(z.promise(z.void())),
});

// Zod schema for IConfigModuleExports
export const ConfigModuleExportsSchema = z.object({
  service: z.function().returns(ConfigServiceSchema)
});

// Zod schema for complete module
export const ConfigModuleSchema = createModuleSchema(ConfigModuleExportsSchema).extend({
  name: z.literal('config'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IConfigService = z.infer<typeof ConfigServiceSchema>;
export type IConfigModuleExports = z.infer<typeof ConfigModuleExportsSchema>;
