// Auto-generated database types for users module
// Generated on: 2025-07-28T20:02:59.639Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: users
 * Do not modify this file manually - it will be overwritten
 */
export interface IUsersRow {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  role: string;
  status: string;
  email_verified: boolean | null;
  last_login_at: string | null;
  login_attempts: number | null;
  locked_until: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: user_profiles
 * Do not modify this file manually - it will be overwritten
 */
export interface IUserProfilesRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  timezone: string | null;
  language: string | null;
  metadata: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: user_sessions
 * Do not modify this file manually - it will be overwritten
 */
export interface IUserSessionsRow {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string | null;
  last_activity_at: string | null;
}

/**
 * Generated from database table: user_api_keys
 * Do not modify this file manually - it will be overwritten
 */
export interface IUserApiKeysRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  permissions: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type UsersDatabaseRow = IUsersRow | IUserProfilesRow | IUserSessionsRow | IUserApiKeysRow;

/**
 * Database table names for this module
 */
export const USERS_TABLES = {
  USERS: 'users',
  USERPROFILES: 'user_profiles',
  USERSESSIONS: 'user_sessions',
  USERAPIKEYS: 'user_api_keys',
} as const;
