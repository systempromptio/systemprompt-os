/**
 * @file Identity Provider Interface.
 * @module modules/core/auth/types/provider-interface
 * This file defines the interfaces for OAuth2/OIDC providers
 * Using standard OAuth2 types from RFC 6749
 */

// OAuth2 types embedded directly to avoid external dependencies
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // For OpenID Connect
}

export interface OAuth2ClientCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scope?: string;
}

export interface IDPUserInfo {
  id: string;
  email?: string;
  email_verified?: boolean; // Standard OpenID Connect claim
  name?: string;
  picture?: string;
  locale?: string;
  // Additional provider-specific fields
  raw?: Record<string, any>;
}

// Type aliases for backward compatibility
export type IDPTokens = OAuth2TokenResponse;
export type IDPConfig = OAuth2ClientCredentials;

export interface IdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';

    getAuthorizationUrl(state: string, nonce?: string): string;

    exchangeCodeForTokens(code: string): Promise<IDPTokens>;

    getUserInfo(accessToken: string): Promise<IDPUserInfo>;

    refreshTokens?(refreshToken: string): Promise<IDPTokens>;

    revokeTokens?(token: string): Promise<void>;
}
