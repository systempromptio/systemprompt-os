/**
 * @file OAuth2 Well-Known endpoints for OpenID Connect discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';
/*
 * Import { exportJWK, generateKeyPair } from 'jose';
 * TODO: Implement proper key generation
 */

/**
 * OpenID Connect Configuration Response
 * Following the official OpenID Connect Discovery specification.
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
  private readonly baseUrl: string;
  private readonly publicKeyJWK: any | null = null;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['BASE_URL'] || 'http://localhost:3000';
  }
  
  getOpenIDConfiguration = (_req: Request, res: Response): Response => {
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
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
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
        'agent_type',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    };

    return res.json(config);
  };
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    // Initialize keys if needed
    // TODO: Implement key initialization when JWT service is available

    if (!this.publicKeyJWK) {
      return res.status(500).json({ error: 'Keys not initialized' });
    }

    const jwks = {
      keys: [this.publicKeyJWK],
    };

    return res.json(jwks);
  };
}
