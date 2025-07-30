// Auto-generated database types for auth module
// Generated on: 2025-07-30T14:04:58.743Z
// Do not modify this file manually - it will be overwritten

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
 * Generated from database table: auth_providers
 * Do not modify this file manually - it will be overwritten
 */
export interface IAuthProvidersRow {
  id: string;
  name: string;
  type: string;
  enabled: number | null;
  client_id: string;
  client_secret: string;
  redirect_uri: string | null;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string | null;
  jwks_uri: string | null;
  issuer: string | null;
  discovery_endpoint: string | null;
  scopes: string | null;
  userinfo_mapping: string | null;
  metadata: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type AuthDatabaseRow = IAuthOauthIdentitiesRow | IAuthSessionsRow | IAuthTokensRow | IAuthTokenScopesRow | IAuthAuthorizationCodesRow | IAuthProvidersRow;

/**
 * Database table names for this module
 */
export const AUTH_TABLES = {
  AUTHOAUTHIDENTITIES: 'auth_oauth_identities',
  AUTHSESSIONS: 'auth_sessions',
  AUTHTOKENS: 'auth_tokens',
  AUTHTOKENSCOPES: 'auth_token_scopes',
  AUTHAUTHORIZATIONCODES: 'auth_authorization_codes',
  AUTHPROVIDERS: 'auth_providers',
} as const;
