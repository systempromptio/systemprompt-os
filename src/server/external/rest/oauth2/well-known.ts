/**
 * @file OAuth2 Well-Known endpoints for OAuth 2.1 discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import type { IOAuth2ServerMetadataInternal } from '@/modules/core/auth/types/oauth2.types';

/**
 * OpenID Configuration interface (alias to OAuth2 Server Metadata)
 * Follows OpenID Connect Discovery specification.
 */
export type OpenIDConfiguration = IOAuth2ServerMetadataInternal;

export class WellKnownEndpoint {
  private readonly publicKeyJWK: any | null = null;
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
