/**
 * @file OAuth2 Well-Known endpoints for OpenID Connect discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import { getAuthModule } from '@/modules/core/auth/index';

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
  private readonly publicKeyJWK: any | null = null;
  getOpenIDConfiguration = (_req: Request, res: Response): Response => {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const config = oauth2ConfigService.getOpenIDConfiguration();

    return res.json(config);
  };
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    if (!this.publicKeyJWK) {
      return res.status(500).json({ error: 'Keys not initialized' });
    }

    const jwks = {
      keys: [this.publicKeyJWK],
    };

    return res.json(jwks);
  };
}
