/**
 * CLI validation schemas for events module commands
 * Centralizes Zod validation schemas used across CLI commands.
 */

import { z } from 'zod';

/**
 * Common CLI options shared across commands.
 */
const commonCliOptions = {
  format: z.enum(['text', 'json']).default('text'),
};

/**
 * Event CLI validation schemas.
 */
export const cliSchemas = {
  /**
   * Status command validation schema.
   */
  status: z.object({
    ...commonCliOptions,
    verbose: z.boolean().default(false),
    limit: z.coerce.number().positive()
.max(100)
.default(10)
  }),

  /**
   * List command validation schema.
   */
  list: z.object({
    ...commonCliOptions,
    limit: z.coerce.number().positive()
.max(1000)
.default(20),
    eventName: z.string().min(1)
.optional(),
    verbose: z.boolean().default(false)
  }),

  /**
   * Get command validation schema.
   */
  get: z.object({
    ...commonCliOptions,
    id: z.string().min(1, 'Event ID is required')
  }),

  /**
   * Emit command validation schema.
   */
  emit: z.object({
    ...commonCliOptions,
    eventName: z.string().min(1, 'Event name is required'),
    data: z.string().optional()
.transform(val => {
      if (!val) { return {}; }
      try {
        return JSON.parse(val);
      } catch {
        return { message: val };
      }
    }),
    source: z.string().default('cli')
  }),

  /**
   * Clear command validation schema.
   */
  clear: z.object({
    ...commonCliOptions,
    type: z.enum(['events', 'subscriptions', 'all']).default('events'),
    confirm: z.boolean().default(false)
  })
};

/**
 * Type exports for CLI command arguments.
 */
export type StatusArgs = z.infer<typeof cliSchemas.status>;
export type ListArgs = z.infer<typeof cliSchemas.list>;
export type GetArgs = z.infer<typeof cliSchemas.get>;
export type EmitArgs = z.infer<typeof cliSchemas.emit>;
export type ClearArgs = z.infer<typeof cliSchemas.clear>;
