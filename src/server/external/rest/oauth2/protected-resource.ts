/**
 * @file OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728).
 * @module server/external/rest/oauth2/protected-resource
 * @see {@link https://datatracker.ietf.org/doc/rfc9728/}
 */

import type { Request, Response } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton.js';

/**
 * OAuth 2.0 Protected Resource Metadata Response
 * Following RFC 9728 specification.
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_signing_alg_values_supported?: string[];
  resource_encryption_alg_values_supported?: string[];
  resource_encryption_enc_values_supported?: string[];
  scopes_supported?: string[];
}

export class ProtectedResourceEndpoint {
  getProtectedResourceMetadata = (_req: Request, res: Response): Response => {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const metadata = oauth2ConfigService.getProtectedResourceMetadata();

    return res.json(metadata);
  };
}
