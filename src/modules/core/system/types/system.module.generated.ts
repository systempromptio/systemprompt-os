// Auto-generated Zod schemas for system module
// Generated on: 2025-07-31T11:41:30.111Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { SystemConfigTypeSchema, SystemModulesStatusSchema, SystemEventsSeveritySchema, SystemMaintenanceTypeSchema } from './database.generated';
import { SystemConfigRowSchema } from './database.generated';

// System schema - directly use database row schema
export const SystemSchema = SystemConfigRowSchema;

export const SystemCreateDataSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.unknown(),
  description: z.string().nullable(),
  is_secret: z.number().nullable(),
  is_readonly: z.number().nullable(),
});

export const SystemUpdateDataSchema = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
  type: z.unknown().optional(),
  description: z.string().nullable().optional(),
  is_secret: z.number().nullable().optional(),
  is_readonly: z.number().nullable().optional(),
});

// Type inference from schemas
export type System = z.infer<typeof SystemSchema>;
export type SystemCreateData = z.infer<typeof SystemCreateDataSchema>;
export type SystemUpdateData = z.infer<typeof SystemUpdateDataSchema>;

// Domain type aliases for easier imports
export type ISystem = System;
export type ISystemCreateData = SystemCreateData;
export type ISystemUpdateData = SystemUpdateData;
