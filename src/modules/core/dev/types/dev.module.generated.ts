// Auto-generated Zod schemas for dev module
// Generated on: 2025-08-01T10:07:05.834Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { DevProfilesRowSchema } from './database.generated';

// Dev schema - directly use database row schema
export const DevSchema = DevProfilesRowSchema;

export const DevCreateDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  config_enabled: z.number().nullable(),
  config_auto_save: z.number().nullable(),
  config_debug_mode: z.number().nullable(),
});

export const DevUpdateDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  config_enabled: z.number().nullable().optional(),
  config_auto_save: z.number().nullable().optional(),
  config_debug_mode: z.number().nullable().optional(),
});

// Type inference from schemas
export type Dev = z.infer<typeof DevSchema>;
export type DevCreateData = z.infer<typeof DevCreateDataSchema>;
export type DevUpdateData = z.infer<typeof DevUpdateDataSchema>;

// Domain type aliases for easier imports
export type IDev = Dev;
export type IDevCreateData = DevCreateData;
export type IDevUpdateData = DevUpdateData;
