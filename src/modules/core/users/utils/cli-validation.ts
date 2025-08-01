/**
 * CLI validation utilities for users module.
 * @file CLI validation utilities following SystemPrompt patterns.
 * @module modules/core/users/utils/cli-validation
 */

import { z } from 'zod';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { 
  UserCreateDataSchema,
  UserUpdateDataSchema 
} from '../types/users.module.generated';
import { UsersStatusSchema } from '../types/database.generated';

// Base CLI options that all commands should have
const baseCliOptionsSchema = z.object({
  format: z.enum(['text', 'json']).default('text')
});

// Common CLI transformations for string inputs
const cliTransforms = {
  // String to boolean
  boolean: z.enum(['true', 'false']).transform(v => v === 'true'),
  
  // String to number with validation
  number: z.coerce.number(),
  positiveInt: z.coerce.number().int().positive(),
  
  // Optional boolean with default
  optionalBoolean: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional()
    .default('false'),
    
  // Date parsing
  date: z.coerce.date(),
  
  // JSON parsing for complex inputs
  json: z.string().transform(str => JSON.parse(str))
};

// Composed schemas for each command
export const cliSchemas = {
  // Create user command schema
  create: UserCreateDataSchema.extend({
    format: z.enum(['text', 'json']).default('text'),
    // Transform string booleans from CLI
    emailVerified: z.enum(['true', 'false'])
      .transform(v => v === 'true')
      .optional()
      .default('false')
  }).transform(data => ({
    ...data,
    // Map CLI arg names to schema field names
    email_verified: data.emailVerified ?? false
  })),
  
  // Update user command schema
  update: z.object({
    id: z.string().uuid('Invalid user ID format'),
    format: z.enum(['text', 'json']).default('text'),
    // All update fields are optional
    username: z.string().optional(),
    email: z.string().email().optional(),
    display_name: z.string().nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    bio: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    status: UsersStatusSchema.optional(),
    email_verified: z.enum(['true', 'false'])
      .transform(v => v === 'true')
      .optional(),
    preferences: z.string().nullable().optional(),
    metadata: z.string().nullable().optional()
  }).refine(data => {
    const updateFields = Object.keys(data).filter(key => 
      key !== 'id' && key !== 'format' && data[key] !== undefined
    );
    return updateFields.length > 0;
  }, {
    message: 'At least one field must be provided for update'
  }),
  
  // List users command schema
  list: baseCliOptionsSchema.extend({
    status: UsersStatusSchema.optional(),
    limit: z.coerce.number().positive().max(100).default(20),
    page: z.coerce.number().positive().default(1),
    sortBy: z.enum(['created_at', 'updated_at', 'username']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),
  
  // Get user command schema
  get: baseCliOptionsSchema.extend({
    id: z.string().uuid().optional(),
    username: z.string().optional()
  }).refine(data => data.id || data.username, {
    message: 'Either id or username must be provided'
  }),
  
  // Delete user command schema
  delete: z.object({
    id: z.string().uuid('Invalid user ID format'),
    force: z.enum(['true', 'false'])
      .transform(v => v === 'true')
      .default('false'),
    format: z.enum(['text', 'json']).default('text')
  }),
  
  // Status command schema
  status: baseCliOptionsSchema
};

// Type-safe validation function
export function validateCliArgs<T extends keyof typeof cliSchemas>(
  command: T,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): z.infer<typeof cliSchemas[T]> | null {
  try {
    return cliSchemas[command].parse(args);
  } catch (error) {
    if (error instanceof z.ZodError) {
      cliOutput.error('Invalid arguments:');
      error.errors.forEach(err => {
        const field = err.path.join('.');
        cliOutput.error(`  ${field}: ${err.message}`);
      });
    } else {
      cliOutput.error('Validation error occurred');
    }
    return null;
  }
}

// Utility to build clean update data from CLI args
export function buildUpdateData(validatedArgs: z.infer<typeof cliSchemas.update>): Record<string, unknown> {
  const { id, format, ...updateData } = validatedArgs;
  
  return Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  );
}

// Common validation patterns for reuse
export const validationPatterns = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  positiveNumber: z.coerce.number().positive('Must be a positive number'),
  nonEmptyString: z.string().min(1, 'Cannot be empty'),
  cliFormat: z.enum(['text', 'json']).default('text'),
  userStatus: UsersStatusSchema,
  booleanString: z.enum(['true', 'false']).transform(v => v === 'true')
};

// Export types for use in CLI commands
export type CreateUserArgs = z.infer<typeof cliSchemas.create>;
export type UpdateUserArgs = z.infer<typeof cliSchemas.update>;
export type ListUsersArgs = z.infer<typeof cliSchemas.list>;
export type GetUserArgs = z.infer<typeof cliSchemas.get>;
export type DeleteUserArgs = z.infer<typeof cliSchemas.delete>;
export type StatusArgs = z.infer<typeof cliSchemas.status>;