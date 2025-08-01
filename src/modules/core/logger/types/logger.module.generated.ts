// Auto-generated Zod schemas for logger module
// Generated on: 2025-08-01T14:31:17.308Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { LoggerDatabaseRowSchema } from './database.generated';

// Logger schema - directly use database row schema
export const LoggerSchema = LoggerDatabaseRowSchema;

export const LoggerCreateDataSchema = z.object({
  timestamp: z.string().datetime(),
  level: z.string(),
  source: z.string(),
  category: z.string().nullable(),
  message: z.string(),
  args: z.string(),
});

export const LoggerUpdateDataSchema = z.object({
  timestamp: z.string().datetime().optional(),
  level: z.string().optional(),
  source: z.string().optional(),
  category: z.string().nullable().optional(),
  message: z.string().optional(),
  args: z.string().optional(),
});

// Type inference from schemas
export type Logger = z.infer<typeof LoggerSchema>;
export type LoggerCreateData = z.infer<typeof LoggerCreateDataSchema>;
export type LoggerUpdateData = z.infer<typeof LoggerUpdateDataSchema>;

// Domain type aliases for easier imports
export type ILogger = Logger;
export type ILoggerCreateData = LoggerCreateData;
export type ILoggerUpdateData = LoggerUpdateData;
