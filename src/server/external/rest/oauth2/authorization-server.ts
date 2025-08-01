/**
 * OAuth 2.0 Authorization Server Metadata endpoint implementation.
 * Provides discovery metadata for OAuth 2.0 authorization server as per RFC 8414.
 * @file OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * @module server/external/rest/oauth2/authorization-server
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { IOAuth2ServerMetadataInternal } from '../../../../modules/core/auth/types/oauth2.types';

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
   * @returns Promise that resolves to Express response with JSON metadata.
   */
  getAuthorizationServerMetadata = async (
    req: ExpressRequest,
    res: ExpressResponse
  ): Promise<ExpressResponse> => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const metadata = await this.getMetadata();
      return res.json(metadata);
    } catch (error) {
      console.error('OAuth2 authorization server metadata error:', error);
      return res.status(500).json({
        error: 'internal_server_error',
        error_description: error instanceof Error ? error.message : 'Failed to get authorization server metadata'
      });
    }
  };

  /**
   * Retrieves OAuth 2.0 authorization server metadata.
   * @returns Promise that resolves to the authorization server metadata conforming to RFC 8414.
   */
  private async getMetadata(): Promise<IOAuth2ServerMetadataInternal> {
    const baseUrl = process.env.BASE_URL || process.env.OAUTH_BASE_URL || 'http://localhost:3000';

    return {
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
  }
}
