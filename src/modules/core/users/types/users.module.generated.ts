// Auto-generated Zod schemas for users module
// Generated on: 2025-07-31T11:41:29.480Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { UsersStatusSchema } from './database.generated';
import { UsersRowSchema } from './database.generated';

// User schema - directly use database row schema
export const UserSchema = UsersRowSchema;

export const UserCreateDataSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  bio: z.string().nullable(),
  timezone: z.string().nullable(),
  language: z.string().nullable(),
  status: UsersStatusSchema,
  email_verified: z.boolean().nullable(),
  preferences: z.string().nullable(),
  metadata: z.string().nullable(),
});

export const UserUpdateDataSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  status: UsersStatusSchema.optional(),
  email_verified: z.boolean().nullable().optional(),
  preferences: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
});

// Type inference from schemas
export type User = z.infer<typeof UserSchema>;
export type UserCreateData = z.infer<typeof UserCreateDataSchema>;
export type UserUpdateData = z.infer<typeof UserUpdateDataSchema>;

// Domain type aliases for easier imports
export type IUser = User;
export type IUserCreateData = UserCreateData;
export type IUserUpdateData = UserUpdateData;
