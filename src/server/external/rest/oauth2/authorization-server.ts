/**
 * OAuth 2.0 Authorization Server Metadata endpoint implementation.
 * Provides discovery metadata for OAuth 2.0 authorization server as per RFC 8414.
 * @file OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * @module server/external/rest/oauth2/authorization-server
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton';

/**
 * OAuth 2.0 Authorization Server Endpoint handler.
 * Provides methods for handling authorization server metadata requests.
 */
export class AuthorizationServerEndpoint {
  /**
   * Handles requests for OAuth 2.0 authorization server metadata.
   * Returns the server metadata as specified in RFC 8414.
   * @param _req - Express request object (unused).
   * @param res - Express response object.
   * @returns Express response with JSON metadata.
   */
  // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unsafe-member-access
  getAuthorizationServerMetadata = (
    _req: ExpressRequest,
    res: ExpressResponse
  ): ExpressResponse => {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const metadata = oauth2ConfigService.getAuthorizationServerMetadata()
    return res.json(metadata);
  };
}
