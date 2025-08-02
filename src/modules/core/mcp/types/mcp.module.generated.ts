// Auto-generated Zod schemas for mcp module
// Generated on: 2025-08-02T16:08:07.376Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { McpContextsRowSchema } from './database.generated';

// Mcp schema - directly use database row schema
export const McpSchema = McpContextsRowSchema;

export const McpCreateDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  version: z.string().nullable(),
  server_config: z.string(),
  auth_config: z.string().nullable(),
  is_active: z.boolean().nullable(),
  created_by: z.string().nullable(),
});

export const McpUpdateDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  server_config: z.string().optional(),
  auth_config: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  created_by: z.string().nullable().optional(),
});

// Type inference from schemas
export type Mcp = z.infer<typeof McpSchema>;
export type McpCreateData = z.infer<typeof McpCreateDataSchema>;
export type McpUpdateData = z.infer<typeof McpUpdateDataSchema>;

// Domain type aliases for easier imports
export type IMcp = Mcp;
export type IMcpCreateData = McpCreateData;
export type IMcpUpdateData = McpUpdateData;
