/**
 * Auth CLI validation utilities.
 * @file Zod schemas for auth CLI command validation.
 * @module modules/core/auth/utils/cli-validation
 */

import { z } from 'zod';

// Common CLI schemas
const formatSchema = z.enum(['text', 'json']).default('text');
const uuidSchema = z.string().uuid('Invalid UUID format');
const emailSchema = z.string().email('Invalid email format');
const paginationSchema = {
  limit: z.coerce.number().positive().max(100).default(20),
  page: z.coerce.number().positive().default(1)
};

export const cliSchemas = {
  // Session management schemas
  sessionCreate: z.object({
    userId: uuidSchema,
    format: formatSchema
  }),
  
  sessionList: z.object({
    userId: uuidSchema,
    format: formatSchema,
    ...paginationSchema
  }),
  
  sessionValidate: z.object({
    sessionId: uuidSchema,
    format: formatSchema
  }),
  
  sessionRevoke: z.object({
    sessionId: uuidSchema,
    format: formatSchema
  }),
  
  // Authentication schemas
  authenticate: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    format: formatSchema
  }),
  
  // Status and provider schemas
  status: z.object({
    format: formatSchema
  }),
  
  providersList: z.object({
    format: formatSchema
  })
};

// Type inference for CLI arguments
export type SessionCreateArgs = z.infer<typeof cliSchemas.sessionCreate>;
export type SessionListArgs = z.infer<typeof cliSchemas.sessionList>;
export type SessionValidateArgs = z.infer<typeof cliSchemas.sessionValidate>;
export type SessionRevokeArgs = z.infer<typeof cliSchemas.sessionRevoke>;
export type AuthenticateArgs = z.infer<typeof cliSchemas.authenticate>;
export type StatusArgs = z.infer<typeof cliSchemas.status>;
export type ProvidersListArgs = z.infer<typeof cliSchemas.providersList>;