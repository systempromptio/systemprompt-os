/**
 * @fileoverview Identity Provider Interface
 * @module modules/core/auth/types/provider-interface
 * 
 * This file defines the interfaces for OAuth2/OIDC providers
 * It's a copy of the server's interface to maintain module independence
 */

export interface IDPUserInfo {
  id: string;
  email?: string;
  emailverified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  // Additional provider-specific fields
  raw?: Record<string, any>;
}

export interface IDPTokens {
  accesstoken: string;
  tokentype: string;
  expiresin?: number;
  refreshtoken?: string;
  idtoken?: string;
  scope?: string;
}

export interface IDPConfig {
  clientid: string;
  clientsecret: string;
  redirecturi: string;
  scope?: string;
  // Additional provider-specific config
  [key: string]: any;
}

export interface IdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';
  
  /**
   * Get the authorization URL for this provider
   */
  getAuthorizationUrl(state: string, nonce?: string): string;
  
  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string): Promise<IDPTokens>;
  
  /**
   * Get user information from the provider
   */
  getUserInfo(accessToken: string): Promise<IDPUserInfo>;
  
  /**
   * Refresh tokens if supported
   */
  refreshTokens?(refreshToken: string): Promise<IDPTokens>;
  
  /**
   * Revoke tokens if supported
   */
  revokeTokens?(token: string): Promise<void>;
}