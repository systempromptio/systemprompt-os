// Auto-generated database types for auth module
// Generated on: 2025-07-31T10:03:21.448Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for database row validation
export const AuthOauthIdentitiesRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  provider: z.string(),
  provider_user_id: z.string(),
  provider_email: z.string().email().nullable(),
  provider_name: z.string().nullable(),
  provider_picture: z.string().nullable(),
  created_at: z.string().nullable(),
});

export const AuthSessionsRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  token_hash: z.string(),
  refresh_token_hash: z.string().nullable(),
  type: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  expires_at: z.string().datetime(),
  refresh_expires_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  created_at: z.string().datetime().nullable(),
  last_activity_at: z.string().datetime().nullable(),
});

export const AuthTokensRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  name: z.string(),
  token_hash: z.string(),
  type: z.string(),
  expires_at: z.string().datetime().nullable(),
  last_used_at: z.string().datetime().nullable(),
  is_revoked: z.number().nullable(),
  created_at: z.string().datetime().nullable(),
});

export const AuthTokenScopesRowSchema = z.object({
  token_id: z.string(),
  scope: z.string(),
});

export const AuthAuthorizationCodesRowSchema = z.object({
  code: z.string().uuid(),
  client_id: z.string(),
  redirect_uri: z.string(),
  scope: z.string(),
  user_id: z.string().nullable(),
  user_email: z.string().email().nullable(),
  provider: z.string().nullable(),
  provider_tokens: z.string().nullable(),
  code_challenge: z.string().nullable(),
  code_challenge_method: z.string().nullable(),
  expires_at: z.string(),
  created_at: z.string().nullable(),
});

export const AuthProvidersRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  enabled: z.number().nullable(),
  client_id: z.string(),
  client_secret: z.string(),
  redirect_uri: z.string().nullable(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  userinfo_endpoint: z.string().nullable(),
  jwks_uri: z.string().nullable(),
  issuer: z.string().nullable(),
  discovery_endpoint: z.string().nullable(),
  scopes: z.string().nullable(),
  userinfo_mapping: z.string().nullable(),
  metadata: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type AuthDatabaseRow = IAuthOauthIdentitiesRow | IAuthSessionsRow | IAuthTokensRow | IAuthTokenScopesRow | IAuthAuthorizationCodesRow | IAuthProvidersRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const AuthDatabaseRowSchema = z.union([AuthOauthIdentitiesRowSchema, AuthSessionsRowSchema, AuthTokensRowSchema, AuthTokenScopesRowSchema, AuthAuthorizationCodesRowSchema, AuthProvidersRowSchema]);

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
