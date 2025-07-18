/**
 * @fileoverview Provider Manager Service
 * @module modules/core/auth/services/provider-manager
 * 
 * Manages OAuth2/OIDC provider configurations loaded from YAML files
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { IdentityProvider, IDPConfig } from '../types/provider-interface.js';
import { GenericOAuth2Provider } from './providers/generic-oauth2.js';
import { GoogleProvider } from './providers/google.js';
import { GitHubProvider } from './providers/github.js';

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';
  enabled: boolean;
  endpoints: {
    authorization: string;
    token: string;
    userinfo?: string;
    revocation?: string;
    discovery?: string;
    jwks?: string;
    emails?: string; // GitHub-specific
  };
  scopes?: string[];
  parameters?: Record<string, any>;
  token_endpoint_auth_method?: string;
  userinfo_mapping?: Record<string, string>;
  features?: Record<string, any>;
  credentials: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    private_key_path?: string;
    kid?: string;
  };
}

export class ProviderManager {
  private providers = new Map<string, IdentityProvider>();
  private configs = new Map<string, ProviderConfig>();
  private logger: any;
  private configPath: string;

  constructor(configPath: string, logger?: any) {
    this.configPath = configPath;
    this.logger = logger;
  }

  /**
   * Initialize the provider manager by loading all configurations
   */
  async initialize(): Promise<void> {
    await this.loadProviderConfigs();
    await this.instantiateProviders();
  }

  /**
   * Load provider configurations from YAML files
   */
  private async loadProviderConfigs(): Promise<void> {
    const providersPath = join(this.configPath, 'providers');
    
    if (!existsSync(providersPath)) {
      this.logger?.warn(`Providers directory not found: ${providersPath}`);
      return;
    }

    // Load built-in providers
    const files = readdirSync(providersPath).filter(
      file => ['.yaml', '.yml'].includes(extname(file)) && file !== 'template.yaml'
    );

    for (const file of files) {
      try {
        const config = await this.loadProviderConfig(join(providersPath, file));
        if (config && config.enabled) {
          this.configs.set(config.id, config);
          this.logger?.info(`Loaded provider config: ${config.id}`);
        }
      } catch (error) {
        this.logger?.error(`Failed to load provider config ${file}:`, error);
      }
    }

    // Load custom providers
    const customPath = join(providersPath, 'custom');
    if (existsSync(customPath)) {
      const customFiles = readdirSync(customPath).filter(
        file => ['.yaml', '.yml'].includes(extname(file))
      );

      for (const file of customFiles) {
        try {
          const config = await this.loadProviderConfig(join(customPath, file));
          if (config && config.enabled) {
            this.configs.set(config.id, config);
            this.logger?.info(`Loaded custom provider config: ${config.id}`);
          }
        } catch (error) {
          this.logger?.error(`Failed to load custom provider config ${file}:`, error);
        }
      }
    }
  }

  /**
   * Load a single provider configuration file
   */
  private async loadProviderConfig(filePath: string): Promise<ProviderConfig | null> {
    const content = readFileSync(filePath, 'utf8');
    const rawConfig = parseYaml(content) as any;

    // Substitute environment variables
    const config = this.substituteEnvVars(rawConfig) as ProviderConfig;

    // Validate required fields
    if (!config.id || !config.credentials?.client_id || !config.credentials?.client_secret) {
      this.logger?.warn(`Skipping provider config ${filePath}: missing required fields`);
      return null;
    }

    // Auto-enable provider if credentials are present
    if (config.credentials.client_id && config.credentials.client_secret) {
      config.enabled = true;
    }

    return config;
  }

  /**
   * Recursively substitute environment variables in configuration
   */
  private substituteEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      // Replace ${VAR_NAME} with environment variable value
      return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteEnvVars(item));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Instantiate provider implementations from configurations
   */
  private async instantiateProviders(): Promise<void> {
    for (const [id, config] of this.configs) {
      try {
        const provider = await this.createProvider(config);
        if (provider) {
          this.providers.set(id, provider);
          this.logger?.info(`Instantiated provider: ${id}`);
        }
      } catch (error) {
        this.logger?.error(`Failed to instantiate provider ${id}:`, error);
      }
    }
  }

  /**
   * Create a provider instance from configuration
   */
  private async createProvider(config: ProviderConfig): Promise<IdentityProvider | null> {
    const idpConfig: IDPConfig = {
      clientid: config.credentials.client_id,
      clientsecret: config.credentials.client_secret,
      redirecturi: config.credentials.redirect_uri,
      scope: config.scopes?.join(' '),
    };

    // Use specific provider implementations for known providers
    switch (config.id) {
      case 'google':
        return new GoogleProvider(idpConfig);
      
      case 'github':
        return new GitHubProvider(idpConfig);
      
      default:
        // Use generic provider for all others
        if (config.type === 'oauth2' || config.type === 'oidc') {
          const genericConfig = {
            ...idpConfig,
            id: config.id,
            name: config.name,
            authorizationendpoint: config.endpoints.authorization,
            tokenendpoint: config.endpoints.token,
            userinfoendpoint: config.endpoints.userinfo,
            issuer: config.type === 'oidc' ? config.endpoints.discovery?.replace('/.well-known/openid-configuration', '') : undefined,
            jwksuri: config.endpoints.jwks,
            userinfomapping: config.userinfo_mapping,
          };

          // If OIDC with discovery URL, fetch configuration
          if (config.type === 'oidc' && config.endpoints.discovery) {
            try {
              const discovered = await this.discoverOIDCConfiguration(config.endpoints.discovery);
              Object.assign(genericConfig, discovered);
            } catch (error) {
              this.logger?.warn(`Failed to discover OIDC config for ${config.id}:`, error);
            }
          }

          return new GenericOAuth2Provider(genericConfig);
        }
        
        this.logger?.warn(`Unsupported provider type ${config.type} for ${config.id}`);
        return null;
    }
  }

  /**
   * Discover OIDC configuration from well-known endpoint
   */
  private async discoverOIDCConfiguration(discoveryUrl: string): Promise<any> {
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC discovery: ${response.statusText}`);
    }

    const config = await response.json() as any;
    return {
      authorizationendpoint: config.authorization_endpoint,
      tokenendpoint: config.token_endpoint,
      userinfoendpoint: config.userinfo_endpoint,
      jwksuri: config.jwks_uri,
      issuer: config.issuer,
    };
  }

  /**
   * Get a provider by ID
   */
  getProvider(id: string): IdentityProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all enabled providers
   */
  getAllProviders(): IdentityProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(id: string): ProviderConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Check if a provider is available
   */
  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * List available provider IDs
   */
  listProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Reload provider configurations
   */
  async reload(): Promise<void> {
    this.providers.clear();
    this.configs.clear();
    await this.initialize();
  }
}