// Auto-generated service schemas for config module
// Generated on: 2025-08-01T14:30:32.992Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { ConfigSchema, ConfigUpdateDataSchema } from './config.module.generated';

// Local definitions to avoid import issues
enum ModulesType {
  CORE = 'core'
}

const createModuleSchema = <T extends z.ZodTypeAny>(exportsSchema: T) => { return z.object({
  name: z.string(),
  version: z.string(),
  type: z.nativeEnum(ModulesType),
  dependencies: z.array(z.string()).readonly().optional(),
  status: z.string(),
  exports: exportsSchema,
  initialize: z.function().returns(z.promise(z.void()))
}) };

// Zod schema for ConfigService
export const ConfigServiceSchema = z.object({
  setConfig: z.function()
    .args(z.string(), z.string(), z.unknown())
    .returns(z.promise(ConfigSchema)),
  getConfig: z.function()
    .args(z.string())
    .returns(z.promise(ConfigSchema.nullable())),
  listConfigs: z.function()
    .args(z.string())
    .returns(z.promise(z.array(ConfigSchema))),
  deleteConfig: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  updateConfig: z.function()
    .args(z.string(), ConfigUpdateDataSchema)
    .returns(z.promise(ConfigSchema)),
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
