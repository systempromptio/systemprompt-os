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
import { getAuthModule } from '@/modules/core/auth/index';
import type {
  IOAuth2ProtectedResourceMetadataInternal
} from '@/modules/core/auth/types/oauth2.types';

/**
 * Type alias for protected resource metadata returned by the endpoint.
 * This is the same as IOAuth2ProtectedResourceMetadataInternal but exported
 * for use in tests and other modules.
 */
export type ProtectedResourceMetadata = IOAuth2ProtectedResourceMetadataInternal;

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
   * @returns Promise that resolves to the Express response with protected resource metadata.
   * @throws {Error} If the auth module or OAuth2 config service is not available.
   */
  getProtectedResourceMetadata = async (
    request: ExpressRequest,
    response: ExpressResponse
  ): Promise<ExpressResponse> => {
    try {
      if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
      }

      const authModule = getAuthModule();
      const oauth2ConfigService = authModule.exports.oauth2ConfigService();
      const metadata: IOAuth2ProtectedResourceMetadataInternal
        = await oauth2ConfigService.getProtectedResourceMetadata();

      return response.json(metadata);
    } catch (error) {
      console.error('OAuth2 protected resource metadata error:', error);
      return response.status(500).json({
        error: 'internal_server_error',
        error_description: error instanceof Error ? error.message : 'Unable to retrieve protected resource metadata'
      });
    }
  };
}
