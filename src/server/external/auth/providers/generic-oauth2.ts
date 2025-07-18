/**
 * @fileoverview Generic OAuth2/OIDC Provider
 * @module server/external/auth/providers/generic-oauth2
 */

import { IdentityProvider, IDPConfig, IDPTokens, IDPUserInfo } from './interface.js';

export interface GenericOAuth2Config extends IDPConfig {
  id: string;
  name: string;
  authorizationendpoint: string;
  tokenendpoint: string;
  userinfoendpoint?: string;
  issuer?: string;
  jwksuri?: string;
  scopessupported?: string[];
  responsetypes_supported?: string[];
  granttypes_supported?: string[];
  tokenendpoint_auth_methods?: string[];
  userinfomapping?: {
    id?: string;
    email?: string;
    emailverified?: string;
    name?: string;
    picture?: string;
  };
}

export class GenericOAuth2Provider implements IdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc';
  
  private config: GenericOAuth2Config;
  
  constructor( config: GenericOAuth2Config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.issuer ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: config.scope || 'openid email profile',
      userinfomapping: config.userinfomapping || {},
    };
  }
  
  getAuthorizationUrl( state: string, nonce?: string): string {
    const params = new URLSearchParams({
      clientid: this.config.clientid,
      redirecturi: this.config.redirecturi,
      responsetype: 'code',
      scope: this.config.scope!,
      state,
    });
    
    if (nonce && this.type === 'oidc') {
      params.append('nonce', nonce);
    }
    
    // Add any additional parameters from config
    if (this.config.authorizationparams) {
      Object.entries(this.config.authorizationparams).forEach(([key, value]) => {
        params.append(key, value as string);
      });
    }
    
    return `${this.config.authorizationendpoint}?${params}`;
  }
  
  async exchangeCodeForTokens( code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      granttype: 'authorizationcode',
      code,
      redirecturi: this.config.redirecturi,
      clientid: this.config.clientid,
      clientsecret: this.config.clientsecret,
    });
    
    const response = await fetch(this.config.tokenendpoint, {
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
    if (!this.config.userinfoendpoint) {
      throw new Error('UserInfo endpoint not configured');
    }
    
    const response = await fetch(this.config.userinfoendpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    const mapping = this.config.userinfomapping!;
    
    // Map the response to our standard format
    return {
      id: this.getNestedValue(data, mapping.id || 'sub') || data.sub || data.id,
      email: this.getNestedValue(data, mapping.email || 'email'),
      emailverified: this.getNestedValue(data, mapping.emailverified || 'emailverified'),
      name: this.getNestedValue(data, mapping.name || 'name'),
      picture: this.getNestedValue(data, mapping.picture || 'picture'),
      raw: data as Record<string, any>,
    };
  }
  
  async refreshTokens( refreshToken: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      granttype: 'refreshtoken',
      refreshtoken: refreshToken,
      clientid: this.config.clientid,
      clientsecret: this.config.clientsecret,
    });
    
    const response = await fetch(this.config.tokenendpoint, {
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
    authorizationendpoint: config.authorizationendpoint,
    tokenendpoint: config.tokenendpoint,
    userinfoendpoint: config.userinfoendpoint,
    jwksuri: config.jwksuri,
    scopessupported: config.scopessupported,
    responsetypes_supported: config.responsetypes_supported,
    granttypes_supported: config.granttypes_supported,
    tokenendpoint_auth_methods: config.tokenendpoint_auth_methods_supported,
  };
}