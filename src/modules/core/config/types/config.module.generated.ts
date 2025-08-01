// Auto-generated Zod schemas for config module
// Generated on: 2025-08-01T13:49:49.827Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { ConfigRowSchema } from './database.generated';

// Config schema - directly use database row schema
export const ConfigSchema = ConfigRowSchema;

export const ConfigCreateDataSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.unknown(),
  description: z.string().nullable(),
});

export const ConfigUpdateDataSchema = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
  type: z.unknown().optional(),
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
