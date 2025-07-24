/**
 * @fileoverview Identity Provider Interface
 * @module modules/core/auth/types/provider-interface
 * 
 * This file defines the interfaces for OAuth2/OIDC providers
 * Using standard OAuth2 types from RFC 6749
 */

import type { OAuth2TokenResponse, OAuth2ClientCredentials } from '@/types/oauth2.js';

export interface IDPUserInfo {
  id: string;
  email?: string;
  email_verified?: boolean;  // Standard OpenID Connect claim
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