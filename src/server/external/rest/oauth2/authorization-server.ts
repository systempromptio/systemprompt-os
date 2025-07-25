/**
 * @file OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * @module server/external/rest/oauth2/authorization-server
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

import type { Request, Response } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton';

/**
 * OAuth 2.0 Authorization Server Metadata Response
 * Following RFC 8414 specification.
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
  getAuthorizationServerMetadata = (_req: Request, res: Response): Response => {
    const authModule = getAuthModule();
    const oauth2ConfigService = authModule.exports.oauth2ConfigService();
    const metadata = oauth2ConfigService.getAuthorizationServerMetadata();

    return res.json(metadata);
  };
}
