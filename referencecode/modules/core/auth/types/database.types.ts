/**
 * Database types for the auth module
 * @module auth/types/database
 */

/**
 * Represents a user row from the auth_users table
 */
export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  is_active: number;
  is_email_verified: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  login_count: number;
  failed_login_count: number;
  locked_until?: string;
  password_hash?: string;
  password_reset_token?: string;
  password_reset_expires?: string;
  email_verification_token?: string;
  email_verification_expires?: string;
}

/**
 * Represents a role row from the auth_roles table
 */
export interface AuthRoleRow {
  id: string;
  name: string;
  description?: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a permission row from the auth_permissions table
 */
export interface AuthPermissionRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  created_at: string;
}

/**
 * Represents a user-role relationship from auth_user_roles table
 */
export interface AuthUserRoleRow {
  user_id: string;
  role_id: string;
  granted_at: string;
  granted_by?: string;
}

/**
 * Represents a role-permission relationship from auth_role_permissions table
 */
export interface AuthRolePermissionRow {
  role_id: string;
  permission_id: string;
  granted_at: string;
}

/**
 * Represents an audit log entry from auth_audit_log table
 */
export interface AuthAuditLogRow {
  id: string;
  user_id?: string;
  action: string;
  resource?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  success: number;
  error_message?: string;
  metadata?: string;
  timestamp: string;
}

/**
 * Represents a session from auth_sessions table
 */
export interface AuthSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  last_activity: string;
  expires_at: string;
  created_at: string;
}

/**
 * Represents an OAuth provider from auth_providers table
 */
export interface AuthProviderRow {
  id: string;
  name: string;
  type: string;
  client_id: string;
  client_secret: string;
  authorization_url?: string;
  token_url?: string;
  user_info_url?: string;
  scopes?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a user's OAuth account from auth_user_providers table
 */
export interface AuthUserProviderRow {
  user_id: string;
  provider_id: string;
  provider_user_id: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  profile_data?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a query result count
 */
export interface CountResult {
  count: number;
}

/**
 * Type guard to check if a value is a CountResult
 */
export function isCountResult(value: unknown): value is CountResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'count' in value &&
    typeof (value as CountResult).count === 'number'
  );
}