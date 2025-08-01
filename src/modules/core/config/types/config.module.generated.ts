// Auto-generated Zod schemas for config module
// Generated on: 2025-08-01T14:29:33.414Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { ConfigRowSchema, ConfigTypeSchema } from './database.generated';

// Config schema - directly use database row schema
export const ConfigSchema = ConfigRowSchema;

export const ConfigCreateDataSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: ConfigTypeSchema,
  description: z.string().nullable(),
});

export const ConfigUpdateDataSchema = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
  type: ConfigTypeSchema.optional(),
  description: z.string().nullable().optional(),
});

// Type inference from schemas
export type Config = z.infer<typeof ConfigSchema>;
export type ConfigCreateData = z.infer<typeof ConfigCreateDataSchema>;
export type ConfigUpdateData = z.infer<typeof ConfigUpdateDataSchema>;

// Domain type aliases for easier imports
export type IConfig = Config;
export type IConfigCreateData = ConfigCreateData;
export type IConfigUpdateData = ConfigUpdateData;

// Re-export database types
export { ConfigType, type IConfigRow } from './database.generated';

// Re-export service types for compatibility
export { 
  ConfigModuleExportsSchema, 
  type IConfigModuleExports, 
  type IConfigService 
} from './config.service.generated';
