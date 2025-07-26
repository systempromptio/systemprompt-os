/**
 * OAuth 2.0 Authorization Server Metadata endpoint implementation.
 * Provides discovery metadata for OAuth 2.0 authorization server as per RFC 8414.
 * @file OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * @module server/external/rest/oauth2/authorization-server
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton';
import type { IOAuth2ServerMetadataInternal } from '@/modules/core/auth/types/oauth2.types';

/**
 * OAuth 2.0 Authorization Server Endpoint handler.
 * Provides methods for handling authorization server metadata requests.
 */
export class AuthorizationServerEndpoint {
  /**
   * Handles requests for OAuth 2.0 authorization server metadata.
   * Returns the server metadata as specified in RFC 8414.
   * Sets appropriate headers and returns metadata regardless of request method.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Express response with JSON metadata.
   */
  getAuthorizationServerMetadata = (
    req: ExpressRequest,
    res: ExpressResponse
  ): ExpressResponse => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const metadata = this.getMetadata();
    return res.json(metadata);
  };

  /**
   * Retrieves OAuth 2.0 authorization server metadata.
   * @returns The authorization server metadata conforming to RFC 8414.
   */
  private getMetadata(): IOAuth2ServerMetadataInternal {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const metadata: IOAuth2ServerMetadataInternal
      = oauth2ConfigService.getAuthorizationServerMetadata();
    return metadata;
  }
}
