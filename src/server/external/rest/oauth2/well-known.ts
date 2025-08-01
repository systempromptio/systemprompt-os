/**
 * @file OAuth2 Well-Known endpoints for OAuth 2.1 discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import type { IOAuth2ServerMetadataInternal } from '../../../../modules/core/auth/types/oauth2.types';

/**
 * OpenID Configuration interface (alias to OAuth2 Server Metadata)
 * Follows OpenID Connect Discovery specification.
 */
export type OpenIDConfiguration = IOAuth2ServerMetadataInternal;

export class WellKnownEndpoint {
  private readonly publicKeyJWK: any | null = null;
  getOpenIDConfiguration = async (_req: Request, res: Response): Promise<Response> => {
    const baseUrl = process.env.BASE_URL || process.env.OAUTH_BASE_URL || 'http://localhost:3000';

    const fallbackConfig: IOAuth2ServerMetadataInternal = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      userinfo_endpoint: `${baseUrl}/oauth2/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth2/register`,
      scopes_supported: ['read', 'write', 'admin'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
    };
    return res.json(fallbackConfig);
  };
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    const jwks = {
      keys: this.publicKeyJWK ? [this.publicKeyJWK] : [],
    };

    return res.json(jwks);
  };
}
