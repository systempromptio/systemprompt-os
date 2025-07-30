// Auto-generated database types for users module
// Generated on: 2025-07-30T07:52:14.633Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum UsersStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

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
  metadata: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type UsersDatabaseRow = IUsersRow;

/**
 * Database table names for this module
 */
export const USERS_TABLES = {
  USERS: 'users',
} as const;
