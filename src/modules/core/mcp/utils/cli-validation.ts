/**
 * CLI validation utilities for MCP module
 * @file CLI validation utilities for MCP module
 * @module modules/core/mcp/utils/cli-validation
 */

import { z } from 'zod';
import { 
  McpCreateDataSchema,
  McpUpdateDataSchema 
} from '../types/mcp.module.generated';

// Base CLI options that all commands should have
const baseCliOptionsSchema = z.object({
  format: z.enum(['text', 'json']).default('text')
});

// CLI-specific transformations for MCP
const cliTransforms = {
  // String to boolean
  boolean: z.enum(['true', 'false']).transform(v => v === 'true'),
  
  // String to number with validation
  number: z.coerce.number(),
  positiveNumber: z.coerce.number().positive(),
  
  // Optional boolean with default
  optionalBoolean: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional()
    .default('false'),
};

// Composed schemas for each command
export const cliSchemas = {
  create: McpCreateDataSchema.partial().extend({
    // Make required fields explicit
    name: z.string(),
    model: z.string(),
    format: z.enum(['text', 'json']).default('text'),
    // Transform CLI numbers
    max_tokens: z.coerce.number().positive().optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    top_p: z.coerce.number().min(0).max(1).optional(),
    frequency_penalty: z.coerce.number().min(-2).max(2).optional(),
    presence_penalty: z.coerce.number().min(-2).max(2).optional(),
  }),
  
  update: McpUpdateDataSchema.partial().extend({
    id: z.string().uuid('Invalid context ID format'),
    format: z.enum(['text', 'json']).default('text'),
    // Transform CLI numbers for update
    max_tokens: z.coerce.number().positive().optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    top_p: z.coerce.number().min(0).max(1).optional(),
    frequency_penalty: z.coerce.number().min(-2).max(2).optional(),
    presence_penalty: z.coerce.number().min(-2).max(2).optional(),
  }),
  
  list: baseCliOptionsSchema.extend({
    limit: z.coerce.number().positive().max(100).default(20),
    page: z.coerce.number().positive().default(1),
    status: z.string().optional(),
  }),
  
  get: z.object({
    id: z.string().uuid('Invalid context ID format'),
    format: z.enum(['text', 'json']).default('text'),
  }),
  
  delete: z.object({
    id: z.string().uuid('Invalid context ID format'),
    format: z.enum(['text', 'json']).default('text'),
    confirm: cliTransforms.optionalBoolean,
  }),
  
  status: baseCliOptionsSchema
};

// Type inference from schemas
export type CreateMcpArgs = z.infer<typeof cliSchemas.create>;
export type UpdateMcpArgs = z.infer<typeof cliSchemas.update>;
export type ListMcpArgs = z.infer<typeof cliSchemas.list>;
export type GetMcpArgs = z.infer<typeof cliSchemas.get>;
export type DeleteMcpArgs = z.infer<typeof cliSchemas.delete>;
export type StatusMcpArgs = z.infer<typeof cliSchemas.status>;