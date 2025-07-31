// Auto-generated Zod schemas for monitor module
// Generated on: 2025-07-31T13:04:44.790Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { MonitorDatabaseRowSchema } from './database.generated';

// Monitor schema - directly use database row schema
export const MonitorSchema = MonitorDatabaseRowSchema;

export const MonitorCreateDataSchema = z.object({
  name: z.string(),
  value: z.number(),
  type: z.unknown(),
  unit: z.string().nullable(),
  timestamp: z.string().datetime(),
});

export const MonitorUpdateDataSchema = z.object({
  name: z.string().optional(),
  value: z.number().optional(),
  type: z.unknown().optional(),
  unit: z.string().nullable().optional(),
  timestamp: z.string().datetime().optional(),
});

// Type inference from schemas
export type Monitor = z.infer<typeof MonitorSchema>;
export type MonitorCreateData = z.infer<typeof MonitorCreateDataSchema>;
export type MonitorUpdateData = z.infer<typeof MonitorUpdateDataSchema>;

// Domain type aliases for easier imports
export type IMonitor = Monitor;
export type IMonitorCreateData = MonitorCreateData;
export type IMonitorUpdateData = MonitorUpdateData;
