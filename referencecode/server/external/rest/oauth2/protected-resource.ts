/**
 * @fileoverview OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728)
 * @module server/external/rest/oauth2/protected-resource
 *
 * @see {@link https://datatracker.ietf.org/doc/rfc9728/}
 */

import type { Request, Response } from 'express';
import { tunnelStatus } from '../../../../modules/core/auth/tunnel-status.js';

/**
 * OAuth 2.0 Protected Resource Metadata Response
 * Following RFC 9728 specification
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
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * GET /.well-known/oauth-protected-resource
   * Returns OAuth 2.0 Protected Resource Metadata
   */
  getProtectedResourceMetadata = (_req: Request, res: Response): Response => {
    // Use dynamic base URL from tunnel status or fallback
    const currentBaseUrl = tunnelStatus.getBaseUrlOrDefault(this.baseUrl);

    const metadata: ProtectedResourceMetadata = {
      resource: `${currentBaseUrl}/mcp`,
      authorization_servers: [currentBaseUrl], // Since we're acting as both resource and auth server
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
      resource_documentation: `${currentBaseUrl}/docs/api`,
    };

    return res.json(metadata);
  };
}