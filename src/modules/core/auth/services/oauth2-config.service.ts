/**
 * @file OAuth2 Configuration Service.
 * @module modules/core/auth/services/oauth2-config
 * @description Centralized OAuth2 URL and configuration management.
 */

import { tunnelStatus } from '@/modules/core/auth/tunnel-status';

/**
 * OAuth2 Server Metadata following RFC 8414
 * All properties use snake_case as per OAuth2 spec.
 */
export interface OAuth2ServerMetadata {
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
  userinfo_endpoint?: string;
  acr_values_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  claims_supported?: string[];
}

/**
 * OAuth2 Protected Resource Metadata following RFC 9728
 * All properties use snake_case as per OAuth2 spec.
 */
export interface OAuth2ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_signing_alg_values_supported?: string[];
  resource_encryption_alg_values_supported?: string[];
  resource_encryption_enc_values_supported?: string[];
  scopes_supported?: string[];
}

/**
 * OAuth2 Configuration Service
 * Manages OAuth2 endpoints and metadata configuration.
 */
export class OAuth2ConfigService {
  private static instance: OAuth2ConfigService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = process.env['BASE_URL'] || 'http://localhost:3000';
  }

  static getInstance(): OAuth2ConfigService {
    OAuth2ConfigService.instance ||= new OAuth2ConfigService();
    return OAuth2ConfigService.instance;
  }

  /**
   * Get the current base URL, considering tunnel status.
   */
  getBaseUrl(): string {
    return tunnelStatus.getBaseUrlOrDefault(this.baseUrl);
  }

  /**
   * Get OAuth2 Server Metadata (RFC 8414).
   */
  getAuthorizationServerMetadata(): OAuth2ServerMetadata {
    const baseUrl = this.getBaseUrl();

    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth2/register`,
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
      response_types_supported: ['code', 'code id_token'],
      response_modes_supported: ['query', 'fragment'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      service_documentation: `${baseUrl}/docs/api`,
      code_challenge_methods_supported: ['S256', 'plain'],
      userinfo_endpoint: `${baseUrl}/oauth2/userinfo`,
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
        'agent_type',
      ],
    };
  }

  /**
   * Get OAuth2 Protected Resource Metadata (RFC 9728).
   */
  getProtectedResourceMetadata(): OAuth2ProtectedResourceMetadata {
    const baseUrl = this.getBaseUrl();

    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
      resource_documentation: `${baseUrl}/docs/api`,
    };
  }

  /**
   * Get OpenID Configuration for .well-known endpoint
   * Note: This is similar to Authorization Server Metadata but
   * follows the specific OpenID Connect Discovery spec.
   */
  getOpenIDConfiguration() {
    const metadata = this.getAuthorizationServerMetadata();

    return {
      issuer: metadata.issuer,
      authorization_endpoint: metadata.authorization_endpoint,
      token_endpoint: metadata.token_endpoint,
      userinfo_endpoint: metadata.userinfo_endpoint,
      jwks_uri: metadata.jwks_uri,
      response_types_supported: metadata.response_types_supported,
      subject_types_supported: metadata.subject_types_supported!,
      id_token_signing_alg_values_supported: metadata.id_token_signing_alg_values_supported!,
      scopes_supported: metadata.scopes_supported,
      token_endpoint_auth_methods_supported: metadata.token_endpoint_auth_methods_supported,
      claims_supported: metadata.claims_supported,
      code_challenge_methods_supported: metadata.code_challenge_methods_supported,
      grant_types_supported: metadata.grant_types_supported,
    };
  }

  /**
   * Get provider callback URL.
   * @param provider
   */
  getProviderCallbackUrl(provider: string): string {
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}/oauth2/callback/${provider}`;
  }
}

export const oauth2ConfigService = OAuth2ConfigService.getInstance();
