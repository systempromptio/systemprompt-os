// Auto-generated Zod schemas for cli module
// Generated on: 2025-07-31T11:41:32.754Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { CliCommandOptionsOptionTypeSchema } from './database.generated';
import { CliCommandsRowSchema } from './database.generated';

// Cli schema - directly use database row schema
export const CliSchema = CliCommandsRowSchema;

export const CliCreateDataSchema = z.object({
  module_name: z.string(),
  command_name: z.string(),
  command_path: z.string(),
  description: z.string().nullable(),
  executor_path: z.string(),
  active: z.boolean().nullable(),
});

export const CliUpdateDataSchema = z.object({
  module_name: z.string().optional(),
  command_name: z.string().optional(),
  command_path: z.string().optional(),
  description: z.string().nullable().optional(),
  executor_path: z.string().optional(),
  active: z.boolean().nullable().optional(),
});

// Type inference from schemas
export type Cli = z.infer<typeof CliSchema>;
export type CliCreateData = z.infer<typeof CliCreateDataSchema>;
export type CliUpdateData = z.infer<typeof CliUpdateDataSchema>;

// Domain type aliases for easier imports
export type ICli = Cli;
export type ICliCreateData = CliCreateData;
export type ICliUpdateData = CliUpdateData;
