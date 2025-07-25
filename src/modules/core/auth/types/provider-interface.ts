/**
 * OAuth2 token response interface for handling authentication tokens.
 * Includes access token, token type, expiration time, refresh token, scope, and ID token.
 */
export interface IAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
  idToken?: string;
}

/**
 * OAuth2 client credentials interface for authentication configuration.
 * Contains client ID, secret, redirect URI, and optional scope.
 */
export interface IAuthClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
}

/**
 * Identity Provider user information interface.
 * Contains user ID, email, email verification status, name, picture, locale, and raw data.
 * Email verification follows OpenID Connect standard claims.
 */
export interface IIdpUserInfo {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  raw?: Record<string, unknown>;
}

/**
 * Identity Provider tokens type alias.
 */
export type IdpTokens = IAuthTokenResponse;

/**
 * Identity Provider configuration type alias.
 */
export type IdpConfig = IAuthClientCredentials;

/**
 * Identity Provider interface for authentication providers.
 * Defines standard methods for OAuth2, OIDC, and SAML authentication flows.
 * Includes authorization URL, token exchange, user info, token refresh, and revocation.
 */
export interface IIdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';

  getAuthorizationUrl(state: string, nonce?: string): string;

  exchangeCodeForTokens(_code: string): Promise<IdpTokens>;

  getUserInfo(_accessToken: string): Promise<IIdpUserInfo>;

  refreshTokens?(_refreshToken: string): Promise<IdpTokens>;

  revokeTokens?(_token: string): Promise<void>;
}

/**
 * Google OAuth2 provider configuration interface.
 * Extends base IDP configuration with Google-specific discovery URL.
 */
export interface IGoogleConfig extends IdpConfig {
  discoveryurl?: string;
}

/**
 * Google user information response interface.
 * Contains Google-specific user data including subject ID and additional properties.
 */
export interface IGoogleUserInfo {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  [key: string]: unknown;
}

/**
 * Type aliases for backward compatibility.
 */
export type IdentityProvider = IIdentityProvider;

/**
 * OAuth2 token response type alias for backward compatibility.
 */
export type AuthTokenResponse = IAuthTokenResponse;

/**
 * OAuth2 client credentials type alias for backward compatibility.
 */
export type AuthClientCredentials = IAuthClientCredentials;

/**
 * IDP user info type alias for backward compatibility.
 */
export type IdpUserInfo = IIdpUserInfo;

/**
 * IDP tokens type alias for backward compatibility.
 */
export type IdpTokensCompat = IdpTokens;

/**
 * IDP config type alias for backward compatibility.
 */
export type IdpConfigCompat = IdpConfig;

/**
 * Google config type alias for backward compatibility.
 */
export type GoogleConfig = IGoogleConfig;

/**
 * Google user info type alias for backward compatibility.
 */
export type GoogleUserInfo = IGoogleUserInfo;
