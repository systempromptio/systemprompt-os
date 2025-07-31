// Auto-generated Zod schemas for database module
// Generated on: 2025-07-31T11:41:32.077Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { DatabaseOperationsOperationTypeSchema, DatabaseHealthChecksCheckTypeSchema } from './database.generated';
import { DatabaseSchemaVersionsRowSchema } from './database.generated';

// Database schema - directly use database row schema
export const DatabaseSchema = DatabaseSchemaVersionsRowSchema;

export const DatabaseCreateDataSchema = z.object({
  module_name: z.string(),
  version: z.string(),
  applied_at: z.string().nullable(),
  execution_time_ms: z.number().nullable(),
  statements_count: z.number().nullable(),
});

export const DatabaseUpdateDataSchema = z.object({
  module_name: z.string().optional(),
  version: z.string().optional(),
  applied_at: z.string().nullable().optional(),
  execution_time_ms: z.number().nullable().optional(),
  statements_count: z.number().nullable().optional(),
});

// Type inference from schemas
export type Database = z.infer<typeof DatabaseSchema>;
export type DatabaseCreateData = z.infer<typeof DatabaseCreateDataSchema>;
export type DatabaseUpdateData = z.infer<typeof DatabaseUpdateDataSchema>;

// Domain type aliases for easier imports
export type IDatabase = Database;
export type IDatabaseCreateData = DatabaseCreateData;
export type IDatabaseUpdateData = DatabaseUpdateData;
