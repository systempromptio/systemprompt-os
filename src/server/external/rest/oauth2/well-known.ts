/**
 * @file OAuth2 Well-Known endpoints for OAuth 2.1 discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import type { IOAuth2ServerMetadataInternal } from '@/modules/core/auth/types/oauth2.types';
import { getAuthModule } from '@/modules/core/auth/index';

/**
 * OpenID Configuration interface (alias to OAuth2 Server Metadata)
 * Follows OpenID Connect Discovery specification.
 */
export type OpenIDConfiguration = IOAuth2ServerMetadataInternal;

export class WellKnownEndpoint {
  private readonly publicKeyJWK: any | null = null;
  getOpenIDConfiguration = async (_req: Request, res: Response): Promise<Response> => {
    try {
      const authModule = getAuthModule();
      const oauth2ConfigService = authModule.exports.oauth2ConfigService();
      const config = await oauth2ConfigService.getAuthorizationServerMetadata();
      return res.json(config);
    } catch (error) {
      console.error('OAuth2 well-known metadata error:', error);
      return res.status(500).json({
        error: 'internal_server_error',
        error_description: error instanceof Error ? error.message : 'Unable to retrieve OAuth2 server metadata'
      });
    }
  };
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    const jwks = {
      keys: this.publicKeyJWK ? [this.publicKeyJWK] : [],
    };

    return res.json(jwks);
  };
}
