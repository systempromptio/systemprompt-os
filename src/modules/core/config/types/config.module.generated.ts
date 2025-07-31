// Auto-generated Zod schemas for config module
// Generated on: 2025-07-31T11:41:32.422Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { McpServersScopeSchema } from './database.generated';
import { ConfigsRowSchema } from './database.generated';

// Config schema - directly use database row schema
export const ConfigSchema = ConfigsRowSchema;

export const ConfigCreateDataSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().nullable(),
});

export const ConfigUpdateDataSchema = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
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
