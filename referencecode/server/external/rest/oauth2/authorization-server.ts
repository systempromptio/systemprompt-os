/**
 * @fileoverview OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414)
 * @module server/external/rest/oauth2/authorization-server
 * 
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

import type { Request, Response } from 'express';
import { tunnelStatus } from '../../../../modules/core/auth/tunnel-status.js';

/**
 * OAuth 2.0 Authorization Server Metadata Response
 * Following RFC 8414 specification
 */
export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  token_endpoint_auth_signing_alg_values_supported?: string[];
  service_documentation?: string;
  ui_locales_supported?: string[];
  op_policy_uri?: string;
  op_tos_uri?: string;
  revocation_endpoint?: string;
  revocation_endpoint_auth_methods_supported?: string[];
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
  // OpenID Connect specific fields (when used as OpenID Provider)
  userinfo_endpoint?: string;
  acr_values_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  claims_supported?: string[];
}

export class AuthorizationServerEndpoint {
  private readonly baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }
  
  /**
   * GET /.well-known/oauth-authorization-server
   * Returns OAuth 2.0 Authorization Server Metadata
   */
  getAuthorizationServerMetadata = (_req: Request, res: Response): Response => {
    // Use dynamic base URL from tunnel status or fallback
    const currentBaseUrl = tunnelStatus.getBaseUrlOrDefault(this.baseUrl);
    
    const metadata: AuthorizationServerMetadata = {
      issuer: currentBaseUrl,
      authorization_endpoint: `${currentBaseUrl}/oauth2/authorize`,
      token_endpoint: `${currentBaseUrl}/oauth2/token`,
      jwks_uri: `${currentBaseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${currentBaseUrl}/oauth2/register`,
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
      response_types_supported: ['code', 'code id_token'],
      response_modes_supported: ['query', 'fragment'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none'
      ],
      service_documentation: `${currentBaseUrl}/docs/api`,
      code_challenge_methods_supported: ['S256', 'plain'],
      // OpenID Connect fields
      userinfo_endpoint: `${currentBaseUrl}/oauth2/userinfo`,
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256', 'HS256'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'name',
        'preferred_username',
        'email',
        'email_verified',
        'agent_id',
        'agent_type'
      ]
    };
    
    return res.json(metadata);
  };
}