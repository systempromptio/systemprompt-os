// Auto-generated Zod schemas for mcp module
// Generated on: 2025-08-02T11:28:23.701Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { McpContextsRowSchema } from './database.generated';

// Mcp schema - directly use database row schema
export const McpSchema = McpContextsRowSchema;

export const McpCreateDataSchema = z.object({
  name: z.string(),
  model: z.string(),
  description: z.string().nullable(),
  max_tokens: z.number().nullable(),
  temperature: z.number().nullable(),
  top_p: z.number().nullable(),
  frequency_penalty: z.number().nullable(),
  presence_penalty: z.number().nullable(),
  stop_sequences: z.string().nullable(),
  system_prompt: z.string().nullable(),
});

export const McpUpdateDataSchema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  description: z.string().nullable().optional(),
  max_tokens: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
  top_p: z.number().nullable().optional(),
  frequency_penalty: z.number().nullable().optional(),
  presence_penalty: z.number().nullable().optional(),
  stop_sequences: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
});

// Type inference from schemas
export type Mcp = z.infer<typeof McpSchema>;
export type McpCreateData = z.infer<typeof McpCreateDataSchema>;
export type McpUpdateData = z.infer<typeof McpUpdateDataSchema>;

// Domain type aliases for easier imports
export type IMcp = Mcp;
export type IMcpCreateData = McpCreateData;
export type IMcpUpdateData = McpUpdateData;
