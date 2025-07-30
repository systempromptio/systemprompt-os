/**
 * OAuth2 Configuration Service.
 * Manages OAuth2 endpoints and metadata configuration following RFC standards.
 * Provides singleton access to OAuth2 server metadata, protected resource metadata,
 * Handles dynamic base URL resolution through environment configuration.
 */
export class OAuth2ConfigurationService {
  private static instance: OAuth2ConfigurationService;

  /**
   * Creates a new OAuth2ConfigurationService instance.
   * Private constructor enforces singleton pattern.
   */
  private constructor() {}

  /**
   * Gets the singleton instance of OAuth2ConfigurationService.
   * @returns The OAuth2ConfigurationService singleton instance.
   */
  static getInstance(): OAuth2ConfigurationService {
    if (OAuth2ConfigurationService.instance === undefined) {
      OAuth2ConfigurationService.instance = new OAuth2ConfigurationService();
    }
    return OAuth2ConfigurationService.instance;
  }

  /**
   * Gets the current base URL using centralized URL configuration.
   * @returns Promise that resolves to the current base URL.
   */
  async getBaseUrl(): Promise<string> {
    // For now, use environment variables directly to avoid circular dependencies
    // The system module integration will be improved in a future update
    return process.env.BASE_URL || process.env.OAUTH_BASE_URL || 'https://democontainer.systemprompt.io';
  }

  /**
   * Gets OAuth2 Server Metadata following RFC 8414.
   * Provides complete authorization server metadata including all required
   * and optional endpoints, supported grant types, response types, and
   * authentication methods as defined in the OAuth2 specification.
   * @returns Promise that resolves to the OAuth2 authorization server metadata.
   */
  async getAuthorizationServerMetadata() {
    const baseUrl = await this.getBaseUrl();
    return this.buildServerMetadata(baseUrl);
  }

  /**
   * Gets OAuth2 Protected Resource Metadata following RFC 9728.
   * Provides metadata about the protected resource including supported
   * authorization servers, bearer token methods, and scopes as defined
   * in the OAuth2 Protected Resource Metadata specification.
   * @returns Promise that resolves to the OAuth2 protected resource metadata.
   */
  async getProtectedResourceMetadata() {
    const baseUrl = await this.getBaseUrl();
    return this.buildResourceMetadata(baseUrl);
  }

  /**
   * Gets the provider callback URL for OAuth2 provider redirects.
   * Constructs the callback URL that OAuth2 providers should redirect
   * to after successful authentication. This URL follows the pattern
   * of /oauth2/callback/{provider} where provider is the specific
   * OAuth2 provider identifier.
   * @param provider - The OAuth2 provider identifier.
   * @returns Promise that resolves to the complete callback URL for the specified provider.
   */
  async getProviderCallbackUrl(provider: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return `${baseUrl}/oauth2/callback/${provider}`;
  }

  /**
   * Builds server metadata with proper RFC-compliant property names.
   * @param baseUrl - The base URL for the server.
   * @returns Server metadata with snake_case properties as required by RFC.
   */
  private buildServerMetadata(baseUrl: string) {
    const scopes = ['profile', 'email', 'offline_access', 'agent'];
    const responseTypes = ['code', 'code id_token'];
    const responseModes = ['query', 'fragment'];
    const grantTypes = ['authorization_code', 'refresh_token'];
    const authMethods = ['client_secret_basic', 'client_secret_post', 'none'];
    const challengeMethods = ['S256', 'plain'];
    const subjectTypes = ['public'];
    const signingAlgs = ['RS256', 'HS256'];
    const claims = [
      'sub', 'iss', 'aud', 'exp', 'iat', 'name', 'preferred_username',
      'email', 'email_verified', 'agent_id', 'agent_type',
    ];

    const result = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth2/register`,
      scopes_supported: scopes,
      response_types_supported: responseTypes,
      response_modes_supported: responseModes,
      grant_types_supported: grantTypes,
      token_endpoint_auth_methods_supported: authMethods,
      service_documentation: `${baseUrl}/docs/api`,
      code_challenge_methods_supported: challengeMethods,
      userinfo_endpoint: `${baseUrl}/oauth2/userinfo`,
      subject_types_supported: subjectTypes,
      id_token_signing_alg_values_supported: signingAlgs,
      claims_supported: claims,
    };

    return result;
  }

  /**
   * Builds resource metadata with proper RFC-compliant property names.
   * @param baseUrl - The base URL for the resource.
   * @returns Resource metadata with snake_case properties as required by RFC.
   */
  private buildResourceMetadata(
    baseUrl: string,
  ) {
    const authServers = [baseUrl];
    const bearerMethods = ['header'];
    const scopes = ['profile', 'email', 'offline_access', 'agent'];

    const result = {
      resource: `${baseUrl}/mcp`,
      authorization_servers: authServers,
      bearer_methods_supported: bearerMethods,
      scopes_supported: scopes,
      resource_documentation: `${baseUrl}/docs/api`,
    };

    return result;
  }
}

export const oauth2ConfigService = OAuth2ConfigurationService.getInstance();
