/**
 * Provider Factory Service - Creates OAuth providers dynamically from database configurations.
 * Replaces hardcoded provider instantiation with a flexible factory pattern.
 * @module auth/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import {
  GenericOAuth2Provider,
  discoverOidcConfiguration
} from '@/modules/core/auth/providers/core/oauth2';
import type {
  IDPConfig,
  IGenericOAuth2Config,
  IIdentityProvider
} from '@/modules/core/auth/types/manual';
import type { IAuthProvidersRow } from '@/modules/core/auth/types/database.generated';
import { UrlConfigService } from '@/modules/core/system/services/url-config.service';

/**
 * Factory service for creating OAuth provider instances from database configurations.
 */
export class ProviderFactoryService {
  private static instance: ProviderFactoryService | null = null;
  private readonly logger: ILogger;
  private urlConfigService?: UrlConfigService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.logger = LoggerService.getInstance();
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): ProviderFactoryService {
    if (ProviderFactoryService.instance === null) {
      ProviderFactoryService.instance = new ProviderFactoryService();
    }
    return ProviderFactoryService.instance;
  }

  /**
   * Initialize the service.
   */
  async initialize(): Promise<void> {
    try {
      this.urlConfigService = UrlConfigService.getInstance();
      await this.urlConfigService.initialize();
    } catch (error) {
      this.logger.warn(LogSource.AUTH, 'UrlConfigService not available, using defaults', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    this.logger.info(LogSource.AUTH, 'ProviderFactoryService initialized');
  }

  /**
   * Create a provider instance from database configuration.
   * @param config - The provider configuration from database.
   * @returns Promise resolving to the provider instance or null.
   */
  async createProvider(config: IAuthProvidersRow): Promise<IIdentityProvider | null> {
    try {
      const idpConfig = await this.buildIdpConfig(config);

      if (config.type === 'oidc' && config.discovery_endpoint) {
        return await this.createOidcProviderWithDiscovery(config, idpConfig);
      }

      return await this.createGenericProvider(config, idpConfig);
    } catch (error) {
      this.logger.error(LogSource.AUTH, `Failed to create provider ${config.id}`, {
        error: error instanceof Error ? error : new Error(String(error))
      });
      return null;
    }
  }

  /**
   * Build IDP configuration from database row.
   * @param config - The provider configuration from database.
   * @returns Promise resolving to IDP configuration.
   */
  private async buildIdpConfig(config: IAuthProvidersRow): Promise<IDPConfig> {
    let redirectUri = config.redirect_uri;
    if (!redirectUri && this.urlConfigService) {
      try {
        const baseUrl = await this.urlConfigService.getOAuthCallbackBaseUrl();
        redirectUri = `${baseUrl}/oauth2/callback/${config.id}`;
      } catch (error) {
        redirectUri = `http://localhost:3000/oauth2/callback/${config.id}`;
      }
    }

    return {
      clientId: config.client_id,
      clientSecret: config.client_secret,
      redirectUri: redirectUri || 'http://localhost:3000/oauth2/callback',
      scopes: config.scopes ? JSON.parse(config.scopes) : ['email', 'profile'],
    };
  }

  /**
   * Create an OIDC provider with discovery.
   * @param config - The provider configuration from database.
   * @param idpConfig - The base IDP configuration.
   * @returns Promise resolving to the provider instance.
   */
  private async createOidcProviderWithDiscovery(
    config: IAuthProvidersRow,
    idpConfig: IDPConfig
  ): Promise<IIdentityProvider> {
    this.logger.info(LogSource.AUTH, `Discovering OIDC configuration for ${config.id}`);

    let discovered: Partial<IGenericOAuth2Config> = {};

    try {
      discovered = await discoverOidcConfiguration(config.discovery_endpoint!);
    } catch (error) {
      this.logger.warn(LogSource.AUTH, `Failed to discover OIDC configuration for ${config.id}, using database config`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const genericConfig: IGenericOAuth2Config = {
      id: config.id,
      name: config.name,
      clientId: idpConfig.clientId,
      clientSecret: idpConfig.clientSecret,
      redirectUri: idpConfig.redirectUri,
      authorizationEndpoint: config.authorization_endpoint || discovered.authorizationEndpoint!,
      tokenEndpoint: config.token_endpoint || discovered.tokenEndpoint!,
      scopes: idpConfig.scopes || ['openid', 'email', 'profile'],
    };

    const userinfoEndpoint = config.userinfo_endpoint || discovered.userinfoEndpoint;
    if (userinfoEndpoint) {
      genericConfig.userinfoEndpoint = userinfoEndpoint;
    }

    const jwksUri = config.jwks_uri || discovered.jwksUri;
    if (jwksUri) {
      genericConfig.jwksUri = jwksUri;
    }

    const issuer = config.issuer || discovered.issuer || config.discovery_endpoint;
    if (issuer) {
      genericConfig.issuer = issuer;
    }

    if (config.userinfo_mapping) {
      try {
        genericConfig.userinfoMapping = JSON.parse(config.userinfo_mapping);
      } catch (error) {
        this.logger.warn(LogSource.AUTH, `Invalid userinfo mapping for ${config.id}`);
      }
    }

    if (config.metadata) {
      const metadata = JSON.parse(config.metadata);
      if (metadata && typeof metadata === 'object') {
        genericConfig.authorizationParams = metadata;
      }
    }

    return new GenericOAuth2Provider(genericConfig);
  }

  /**
   * Create a generic OAuth2/OIDC provider.
   * @param config - The provider configuration from database.
   * @param idpConfig - The base IDP configuration.
   * @returns Promise resolving to the provider instance.
   */
  private async createGenericProvider(
    config: IAuthProvidersRow,
    idpConfig: IDPConfig
  ): Promise<IIdentityProvider> {
    const genericConfig: IGenericOAuth2Config = {
      id: config.id,
      name: config.name,
      clientId: idpConfig.clientId,
      clientSecret: idpConfig.clientSecret,
      redirectUri: idpConfig.redirectUri,
      authorizationEndpoint: config.authorization_endpoint,
      tokenEndpoint: config.token_endpoint,
      scopes: idpConfig.scopes || ['openid', 'email', 'profile'],
    };

    if (config.userinfo_endpoint) {
      genericConfig.userinfoEndpoint = config.userinfo_endpoint;
    }
    if (config.jwks_uri) {
      genericConfig.jwksUri = config.jwks_uri;
    }
    if (config.issuer) {
      genericConfig.issuer = config.issuer;
    } else if (config.type === 'oidc') {
      if (config.discovery_endpoint) {
        genericConfig.issuer = config.discovery_endpoint.replace('/.well-known/openid-configuration', '');
      } else if (config.authorization_endpoint) {
        const url = new URL(config.authorization_endpoint);
        genericConfig.issuer = url.origin;
      }
    }
    if (config.userinfo_mapping) {
      try {
        genericConfig.userinfoMapping = JSON.parse(config.userinfo_mapping);
      } catch (error) {
        this.logger.warn(LogSource.AUTH, `Invalid userinfo mapping for ${config.id}`);
      }
    }

    if (config.metadata) {
      try {
        const metadata = JSON.parse(config.metadata);
        if (metadata && typeof metadata === 'object') {
          const {
 response_type, grant_type, token_method, token_auth, ...authParams
} = metadata;

          if (Object.keys(authParams).length > 0) {
            genericConfig.authorizationParams = authParams;
          }
        }
      } catch (error) {
        this.logger.warn(LogSource.AUTH, `Invalid metadata for ${config.id}`);
      }
    }

    this.logger.info(LogSource.AUTH, `Creating generic provider ${config.id} (${config.type})`);
    return new GenericOAuth2Provider(genericConfig);
  }

  /**
   * Validate provider configuration.
   * @param config - The provider configuration to validate.
   * @returns True if valid, false otherwise.
   */
  validateProviderConfig(config: IAuthProvidersRow): boolean {
    if (!config.id || !config.name || !config.type || !config.client_id || !config.client_secret) {
      this.logger.error(LogSource.AUTH, 'Provider missing required fields', { id: config.id });
      return false;
    }

    if (config.type === 'oauth2') {
      if (!config.authorization_endpoint || !config.token_endpoint) {
        this.logger.error(LogSource.AUTH, 'OAuth2 provider missing endpoints', { id: config.id });
        return false;
      }
    }

    if (config.type === 'oidc') {
      if (!config.discovery_endpoint && (!config.authorization_endpoint || !config.token_endpoint)) {
        this.logger.error(LogSource.AUTH, 'OIDC provider needs discovery or endpoints', { id: config.id });
        return false;
      }
    }

    return true;
  }
}
