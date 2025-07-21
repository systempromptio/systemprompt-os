/**
 * @fileoverview OAuth2 Well-Known endpoints for OpenID Connect discovery
 * @module server/external/rest/oauth2/well-known
 */

import { Request, Response } from 'express';
import { tunnelStatus } from '../../../../modules/core/auth/tunnel-status.js';
// import { exportJWK, generateKeyPair } from 'jose';
// TODO: Implement proper key generation

/**
 * OpenID Connect Configuration Response
 * Following the official OpenID Connect Discovery specification
 * @see {@link https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata}
 */
export interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported: string[];
  grant_types_supported: string[];
}

export class WellKnownEndpoint {
  private baseUrl: string;
  private publicKeyJWK: any | null = null;
  
  constructor( baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.initializeKeys();
  }
  
  private async initializeKeys() {
    // For now, use a placeholder JWK (in production, generate proper RSA keys)
    this.publicKeyJWK = {
      kty: 'RSA',
      n: 'placeholder-n-value',
      e: 'AQAB',
      use: 'sig',
      kid: 'systemprompt-os-key-1',
      alg: 'RS256'
    };
  }
  
  /**
   * GET /.well-known/openid-configuration
   * Returns OpenID Connect discovery document
   */
  getOpenIDConfiguration = ( _req: Request, res: Response): Response => {
    // Use dynamic base URL from tunnel status or fallback
    const currentBaseUrl = tunnelStatus.getBaseUrlOrDefault(this.baseUrl);
    
    const config: OpenIDConfiguration = {
      issuer: currentBaseUrl,
      authorization_endpoint: `${currentBaseUrl}/oauth2/authorize`,
      token_endpoint: `${currentBaseUrl}/oauth2/token`,
      userinfo_endpoint: `${currentBaseUrl}/oauth2/userinfo`,
      jwks_uri: `${currentBaseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code', 'code id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256', 'HS256'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none'
      ],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'name',
        'preferred_username',
        'email',
        'email_verified',
        'agent_id',
        'agent_type'
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      grant_types_supported: ['authorization_code', 'refresh_token']
    };
    
    return res.json( config);
  };
  
  /**
   * GET /.well-known/jwks.json
   * Returns JSON Web Key Set for token verification
   */
  getJWKS = async ( _req: Request, res: Response): Promise<Response | void> => {
    if (!this.publicKeyJWK) {
      await this.initializeKeys();
    }
    
    if (!this.publicKeyJWK) {
      return res.status(500).json({ error: 'Keys not initialized' });
    }
    
    const jwks = {
      keys: [this.publicKeyJWK]
    };
    
    return res.json( jwks);
  };
}