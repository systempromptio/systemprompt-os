/**
 *
 * IOAuth2TokenResponse interface.
 *
 */

export interface IIOAuth2TokenResponse {
  accessToken: string;
  tokenType: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // For OpenID Connect
}

/**
 *
 * IOAuth2ClientCredentials interface.
 *
 */

export interface IIOAuth2ClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
}

/**
 *
 * IDPUserInfo interface.
 *
 */

export interface IIDPUserInfo {
  id: string;
  email?: string;
  email_verified?: boolean; // Standard OpenID Connect claim
  name?: string;
  picture?: string;
  locale?: string;
    raw?: Record<string, unknown>;
}

/**
 *
 * IDPTokens type.
 *
 */

export type IDPTokens = OAuth2TokenResponse;
/**
 * IDPConfig type.
 */
export type IDPConfig = OAuth2ClientCredentials;

/**
 *
 * IdentityProvider interface.
 *
 */

export interface IIdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';

    getAuthorizationUrl(state: string, nonce?: string): string;

    exchangeCodeForTokens(_code: string): Promise<IDPTokens>;

    getUserInfo(_accessToken: string): Promise<IDPUserInfo>;

    refreshTokens?(_refreshToken: string): Promise<IDPTokens>;

    revokeTokens?(_token: string): Promise<void>;
}

// Type aliases for compatibility
export type IdentityProvider = IIdentityProvider;
export type OAuth2TokenResponse = IIOAuth2TokenResponse;
export type OAuth2ClientCredentials = IIOAuth2ClientCredentials;
export type IDPUserInfo = IIDPUserInfo;
