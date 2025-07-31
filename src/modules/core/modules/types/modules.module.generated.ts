// Auto-generated Zod schemas for modules module
// Generated on: 2025-07-31T13:04:44.786Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { ModulesHealthStatusSchema, ModulesRowSchema } from './database.generated';

// Module schema - directly use database row schema
export const ModuleSchema = ModulesRowSchema;

export const ModuleCreateDataSchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.unknown(),
  path: z.string(),
  description: z.string().nullable(),
  author: z.string().nullable(),
  enabled: z.boolean().nullable(),
  auto_start: z.boolean().nullable(),
  dependencies: z.string().nullable(),
  config: z.string().nullable(),
  metadata: z.string().nullable(),
  status: z.string().nullable(),
  last_error: z.string().nullable(),
  discovered_at: z.string().nullable(),
  last_started_at: z.string().nullable(),
  last_stopped_at: z.string().nullable(),
  health_status: ModulesHealthStatusSchema.nullable(),
  health_message: z.string().nullable(),
  last_health_check: z.string().nullable(),
});

export const ModuleUpdateDataSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  type: z.unknown().optional(),
  path: z.string().optional(),
  description: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  auto_start: z.boolean().nullable().optional(),
  dependencies: z.string().nullable().optional(),
  config: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  discovered_at: z.string().nullable().optional(),
  last_started_at: z.string().nullable().optional(),
  last_stopped_at: z.string().nullable().optional(),
  health_status: ModulesHealthStatusSchema.nullable().optional(),
  health_message: z.string().nullable().optional(),
  last_health_check: z.string().nullable().optional(),
});

// Type inference from schemas
export type Module = z.infer<typeof ModuleSchema>;
export type ModuleCreateData = z.infer<typeof ModuleCreateDataSchema>;
export type ModuleUpdateData = z.infer<typeof ModuleUpdateDataSchema>;

// Domain type aliases for easier imports
export type IModule = Module;
export type IModuleCreateData = ModuleCreateData;
export type IModuleUpdateData = ModuleUpdateData;
