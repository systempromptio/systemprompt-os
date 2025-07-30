// Auto-generated database types for auth module
// Generated on: 2025-07-30T11:19:39.303Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: auth_credentials
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthCredentialsRow {
  user_id: string;
  password_hash: string | null;
  last_password_change: string | null;
  login_attempts: number | null;
  locked_until: string | null;
  last_login_at: string | null;
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
  provider_email: string | null;
  provider_name: string | null;
  provider_picture: string | null;
  provider_locale: string | null;
  created_at: string | null;
}

/**
 * Generated from database table: auth_sessions
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthSessionsRow {
  id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash: string | null;
  type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  refresh_expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  last_activity_at: string | null;
}

/**
 * Generated from database table: auth_tokens
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthTokensRow {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  type: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_revoked: number | null;
  created_at: string | null;
}

/**
 * Generated from database table: auth_token_scopes
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthTokenScopesRow {
  token_id: string;
  scope: string;
}

/**
 * Generated from database table: auth_mfa
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthMfaRow {
  user_id: string;
  enabled: number | null;
  secret: string | null;
  recovery_email: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: auth_mfa_backup_codes
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthMfaBackupCodesRow {
  id: string;
  user_id: string;
  code_hash: string;
  is_used: number | null;
  created_at: string | null;
  used_at: string | null;
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
  expires_at: string | null;
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
 * Generated from database table: auth_audit_log
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthAuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: number;
  error_message: string | null;
  timestamp: string | null;
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
  code_challenge: string | null;
  code_challenge_method: string | null;
  expires_at: string;
  created_at: string | null;
}

/**
 * Generated from database table: auth_password_reset_tokens
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthPasswordResetTokensRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type AuthDatabaseRow = IAuthCredentialsRow | IAuthOauthIdentitiesRow | IAuthSessionsRow | IAuthTokensRow | IAuthTokenScopesRow | IAuthMfaRow | IAuthMfaBackupCodesRow | IAuthRolesRow | IAuthPermissionsRow | IAuthUserRolesRow | IAuthRolePermissionsRow | IAuthAuditLogRow | IAuthAuthorizationCodesRow | IAuthPasswordResetTokensRow;

/**
 * Database table names for this module
 */
export const AUTH_TABLES = {
  AUTHCREDENTIALS: 'auth_credentials',
  AUTHOAUTHIDENTITIES: 'auth_oauth_identities',
  AUTHSESSIONS: 'auth_sessions',
  AUTHTOKENS: 'auth_tokens',
  AUTHTOKENSCOPES: 'auth_token_scopes',
  AUTHMFA: 'auth_mfa',
  AUTHMFABACKUPCODES: 'auth_mfa_backup_codes',
  AUTHROLES: 'auth_roles',
  AUTHPERMISSIONS: 'auth_permissions',
  AUTHUSERROLES: 'auth_user_roles',
  AUTHROLEPERMISSIONS: 'auth_role_permissions',
  AUTHAUDITLOG: 'auth_audit_log',
  AUTHAUTHORIZATIONCODES: 'auth_authorization_codes',
  AUTHPASSWORDRESETTOKENS: 'auth_password_reset_tokens',
} as const;
