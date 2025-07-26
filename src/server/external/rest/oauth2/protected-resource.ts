/**
 * OAuth 2.0 Protected Resource Metadata endpoint implementation.
 * This module provides the OAuth 2.0 Protected Resource Metadata endpoint
 * following RFC 9728 specification. It allows resource servers to advertise
 * their configuration and capabilities to clients.
 * @file OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728).
 * @module server/external/rest/oauth2/protected-resource
 * @see {@link https://datatracker.ietf.org/doc/rfc9728/}
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton';
import type {
  IOAuth2ProtectedResourceMetadataInternal
} from '@/modules/core/auth/types/oauth2.types';

/**
 * Protected Resource Endpoint handler.
 * Provides OAuth 2.0 protected resource metadata following RFC 9728.
 */
export class ProtectedResourceEndpoint {
  /**
   * Handles GET requests to the protected resource metadata endpoint.
   * Returns OAuth 2.0 protected resource metadata as defined in RFC 9728.
   * The request object is not used as this endpoint returns static metadata.
   * @param request - The Express request object.
   * @param response - The Express response object.
   * @returns The Express response with protected resource metadata.
   * @throws {Error} If the auth module or OAuth2 config service is not available.
   */
  getProtectedResourceMetadata = (
    request: ExpressRequest,
    response: ExpressResponse
  ): ExpressResponse => {
    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const metadata: IOAuth2ProtectedResourceMetadataInternal
      = oauth2ConfigService.getProtectedResourceMetadata();

    return response.json(metadata);
  };
}
