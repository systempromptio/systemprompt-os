// Auto-generated database types for auth module
// Generated on: 2025-07-28T19:59:56.313Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: auth_users
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthUsersRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
  is_active: number | null;
}

/**
 * Generated from database table: auth_oauth_identities
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthOauthIdentitiesRow {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_data: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: auth_roles
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthRolesRow {
  id: string;
  name: string;
  description: string | null;
  is_system: number | null;
  created_at: string | null;
}

/**
 * Generated from database table: auth_permissions
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthPermissionsRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: auth_user_roles
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthUserRolesRow {
  user_id: string;
  role_id: string;
  granted_at: string | null;
  granted_by: string | null;
}

/**
 * Generated from database table: auth_role_permissions
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthRolePermissionsRow {
  role_id: string;
  permission_id: string;
}

/**
 * Generated from database table: auth_sessions
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthSessionsRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string | null;
  last_accessed_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Generated from database table: auth_authorization_codes
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthAuthorizationCodesRow {
  code: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  user_id: string | null;
  user_email: string | null;
  provider: string | null;
  provider_tokens: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
  expires_at: string;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type AuthDatabaseRow = IAuthUsersRow | IAuthOauthIdentitiesRow | IAuthRolesRow | IAuthPermissionsRow | IAuthUserRolesRow | IAuthRolePermissionsRow | IAuthSessionsRow | IAuthAuthorizationCodesRow;

/**
 * Database table names for this module
 */
export const AUTH_TABLES = {
  AUTHUSERS: 'auth_users',
  AUTHOAUTHIDENTITIES: 'auth_oauth_identities',
  AUTHROLES: 'auth_roles',
  AUTHPERMISSIONS: 'auth_permissions',
  AUTHUSERROLES: 'auth_user_roles',
  AUTHROLEPERMISSIONS: 'auth_role_permissions',
  AUTHSESSIONS: 'auth_sessions',
  AUTHAUTHORIZATIONCODES: 'auth_authorization_codes',
} as const;
