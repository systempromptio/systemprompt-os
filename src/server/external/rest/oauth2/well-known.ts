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
  getOpenIDConfiguration = (_req: Request, res: Response): Response => {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const config = oauth2ConfigService.getAuthorizationServerMetadata();
    return res.json(config);
  };
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    const jwks = {
      keys: this.publicKeyJWK ? [this.publicKeyJWK] : [],
    };

    return res.json(jwks);
  };
}
