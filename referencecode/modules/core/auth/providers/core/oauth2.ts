/**
 * @fileoverview Generic OAuth2/OIDC Provider
 * @module modules/core/auth/services/providers/generic-oauth2
 */

import type { IdentityProvider, IDPConfig, IDPTokens, IDPUserInfo } from '../../types/provider-interface.js';

export interface GenericOAuth2Config extends IDPConfig {
  id: string;
  name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  issuer?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods?: string[];
  userinfo_mapping?: {
    id?: string;
    email?: string;
    email_verified?: string;
    name?: string;
    picture?: string;
  };
}

export class GenericOAuth2Provider implements IdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc';
  
  private readonly config: GenericOAuth2Config;
  
  constructor( config: GenericOAuth2Config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.issuer ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: config.scope || 'openid email profile',
      userinfo_mapping: config.userinfo_mapping || {},
    };
  }
  
  getAuthorizationUrl( state: string, nonce?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'code',
      scope: this.config.scope!,
      state,
    });
    
    if (nonce && this.type === 'oidc') {
      params.append('nonce', nonce);
    }
    
    // Add any additional parameters from config
    if ('authorization_params' in this.config && this.config.authorization_params) {
      Object.entries(this.config.authorization_params).forEach(([key, value]) => {
        params.append(key, value as string);
      });
    }
    
    return `${this.config.authorization_endpoint}?${params}`;
  }
  
  async exchangeCodeForTokens( code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirect_uri,
      client_id: this.config.client_id,
      client_secret: this.config.client_secret || '',
    });
    
    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }
    
    const data = await response.json();
    return data as IDPTokens;
  }
  
  async getUserInfo( accessToken: string): Promise<IDPUserInfo> {
    if (!this.config.userinfo_endpoint) {
      throw new Error('UserInfo endpoint not configured');
    }
    
    const response = await fetch(this.config.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    const mapping = this.config.userinfo_mapping!;
    
    // Map the response to our standard format
    return {
      id: this.getNestedValue(data, mapping.id || 'sub') || data.sub || data.id,
      email: this.getNestedValue(data, mapping.email || 'email'),
      email_verified: this.getNestedValue(data, mapping.email_verified || 'email_verified'),
      name: this.getNestedValue(data, mapping.name || 'name'),
      picture: this.getNestedValue(data, mapping.picture || 'picture'),
      raw: data as Record<string, any>,
    };
  }
  
  async refreshTokens( refreshToken: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.client_id,
      client_secret: this.config.client_secret || '',
    });
    
    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as IDPTokens;
  }
  
  private getNestedValue( obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }
}

// Helper to discover OIDC configuration
export async function discoverOIDCConfiguration( issuer: string): Promise<Partial<GenericOAuth2Config>> {
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  
  const response = await fetch( discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }
  
  const config = await response.json() as any;
  
  return {
    issuer: config.issuer,
    authorization_endpoint: config.authorization_endpoint,
    token_endpoint: config.token_endpoint,
    userinfo_endpoint: config.userinfo_endpoint,
    jwks_uri: config.jwks_uri,
    scopes_supported: config.scopes_supported,
    response_types_supported: config.response_types_supported,
    grant_types_supported: config.grant_types_supported,
    token_endpoint_auth_methods: config.token_endpoint_auth_methods_supported,
  };
}