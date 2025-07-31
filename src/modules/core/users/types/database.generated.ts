// Auto-generated database types for users module
// Generated on: 2025-07-31T13:04:45.451Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum UsersStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// Zod schemas for enums
export const UsersStatusSchema = z.nativeEnum(UsersStatus);

/**
 * Generated from database table: users
 * Do not modify this file manually - it will be overwritten
 */
export interface IUsersRow {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  timezone: string | null;
  language: string | null;
  status: UsersStatus;
  email_verified: boolean | null;
  preferences: string | null;
  metadata: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Zod schemas for database row validation
export const UsersRowSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  bio: z.string().nullable(),
  timezone: z.string().nullable(),
  language: z.string().nullable(),
  status: z.nativeEnum(UsersStatus),
  email_verified: z.boolean().nullable(),
  preferences: z.string().nullable(),
  metadata: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type UsersDatabaseRow = IUsersRow;

/**
 * Zod schema for database row type in this module
 */
export const UsersDatabaseRowSchema = UsersRowSchema;

/**
 * Database table names for this module
 */
export const USERS_TABLES = {
  USERS: 'users',
} as const;
