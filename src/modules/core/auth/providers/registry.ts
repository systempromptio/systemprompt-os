import {
 existsSync, readFileSync, readdirSync
} from "fs";
import { extname, join } from "path";
import { parse as parseYaml } from "yaml";
import type { ILogger } from "@/modules/core/logger/types/index.js";
import type { IDPConfig, IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';
import { type GenericOAuth2Config, GenericOAuth2Provider } from '@/modules/core/auth/providers/core/oauth2.js';
import { GoogleProvider } from '@/modules/core/auth/providers/core/google.js';
import { GitHubProvider } from '@/modules/core/auth/providers/core/github.js';
import {
 EIGHTY, FIFTY, FIVE, FORTY, FOUR, ONE, ONE_HUNDRED, SIXTY, TEN, THIRTY, THREE, TWENTY, TWO, ZERO
} from '@/modules/core/auth/constants';

const TWO = TWO;

/**
 *
 * IProviderConfig interface.
 *
 */

export interface IIProviderConfig {
  id: string;
  name: string;
  type: "oauth2" | "oidc" | "saml";
  enabled: boolean;
  endpoints: {
    authorization: string;
    token: string;
    userinfo?: string;
    revocation?: string;
    discovery?: string;
    jwks?: string;
    emails?: string;
  };
  scopes?: string[];
  parameters?: Record<string, unknown>;
  token_endpoint_auth_method?: string;
  userinfo_mapping?: Record<string, string>;
  features?: Record<string, unknown>;
  credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    private_key_path?: string;
    kid?: string;
  };
}

/**
 *
 * IOIDCDiscoveryResponse interface.
 *
 */

export interface IIOIDCDiscoveryResponse {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

/**
 *
 * ProviderRegistry class.
 *
 */

export class ProviderRegistry {
  private readonly providers = new Map<string, IdentityProvider>();
  private readonly configs = new Map<string, IIProviderConfig>();
  private readonly logger?: ILogger;
  private readonly configPath: string;

  /**
   *  * Creates a new ProviderRegistry instance.
   * @param configPath - Base path for provider configuration files.
   * @param logger - Optional logger instance for debugging.
   */
  constructor(configPath: string, logger?: ILogger) {
    this.configPath = configPath;
    if (logger) {
      this.logger = logger;
    }
  }

  /**
   *  * Initializes the registry by loading and instantiating all providers.
   * @returns Promise that resolves when initialization is complete.
   * @throws Error if critical initialization failure occurs.
   */
  async initialize(): Promise<void> {
    await this.loadProviderConfigs();
    await this.instantiateProviders();
  }

  /**
   *  * Loads provider configurations from YAML files.
   * Scans the providers directory for YAML files and loads configurations.
   * For enabled providers. Also checks for custom providers in a subdirectory.
   */
  private async loadProviderConfigs(): Promise<void> {
    const providersPath = join(this.configPath, "providers");

    this.logger?.info(`Looking for providers in: ${providersPath}`);

    if (!existsSync(providersPath)) {
      this.logger?.warn(`Providers directory not found: ${providersPath}`);
      return;
    }

    const yamlFiles = readdirSync(providersPath).filter(
      (file) => { return [".yaml", ".yml"].includes(extname(file)) && file !== "template.yaml" },
    );

    await this.loadProviderFiles(yamlFiles.map(file => { return join(providersPath, file) }));
    await this.loadCustomProviders(providersPath);
  }

  /**
   *  * Loads custom provider configurations.
   * @param basePath - Base providers directory path.
   */
  private async loadCustomProviders(basePath: string): Promise<void> {
    const customPath = join(basePath, "custom");

    if (!existsSync(customPath)) {
      return;
    }

    const customFiles = readdirSync(customPath)
      .filter((file) => { return [".yaml", ".yml"].includes(extname(file)) })
      .map(file => { return join(customPath, file) });

    await this.loadProviderFiles(customFiles, true);
  }

  /**
   *  * Loads provider configuration files.
   * @param filePaths - Array of file paths to load.
   * @param isCustom - Whether these are custom provider files.
   */
  private async loadProviderFiles(filePaths: string[], isCustom = false): Promise<void> {
    const loadPromises = filePaths.map(async (filePath) => {
      try {
        const config = await this.loadProviderConfig(filePath);
        if (config?.enabled) {
          this.configs.set(config.id, config);
          const providerType = isCustom ? "custom provider" : "provider";
          this.logger?.info(`Loaded ${providerType} config: ${config.id}`);
        }
      } catch (error) {
        this.logger?.error(`Failed to load provider config ${filePath}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   *  * Loads a single provider configuration file.
   * @param filePath - Path to the YAML configuration file.
   * @returns Parsed and validated provider configuration or null if invalid.
   */
  private async loadProviderConfig(filePath: string): Promise<IIProviderConfig | null> {
    const content = readFileSync(filePath, "utf8");
    const rawConfig = parseYaml(content) as unknown;
    const config = this.substituteEnvVars(rawConfig) as IIProviderConfig;

    if (!this.isValidProviderConfig(config)) {
      this.logger?.warn(`Skipping provider config ${filePath}: missing required fields`);
      return null;
    }

    if (config.credentials.clientId && config.credentials.clientSecret) {
      config.enabled = true;
    }

    return config;
  }

  /**
   * Validates provider configuration.
   * @param config - Configuration to validate.
   * @returns True if configuration has all required fields.
   */
  private isValidProviderConfig(config: Partial<IIProviderConfig>): config is IIProviderConfig {
    return Boolean(
      config.id
      && config.credentials?.clientId
      && config.credentials?.clientSecret
    );
  }

  /**
   * Recursively substitutes environment variables in configuration.
   * @param obj - Object to process.
   * @returns Object with environment variables substituted.
   */
  private substituteEnvVars(obj: unknown): unknown {
    if (typeof obj === "string") {
      return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        if (varName === "OAUTH_REDIRECT_URI" && process.env['BASE_URL']) {
          return `${process.env['BASE_URL']}/oauth2/callback`;
        }
        return process.env[varName] || match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => { return this.substituteEnvVars(item) });
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }

    return obj;
  }

  /**
   *  * Instantiates provider implementations from configurations.
   * Creates provider instances for all loaded configurations.
   */
  private async instantiateProviders(): Promise<void> {
    const instantiationPromises = Array.from(this.configs.entries()).map(
      async ([id, config]) => {
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
    );

    await Promise.all(instantiationPromises);
  }

  /**
   * Creates a provider instance from configuration.
   * @param config - Provider configuration.
   * @returns Provider instance or null if unsupported.
   */
  private async createProvider(config: IIProviderConfig): Promise<IdentityProvider | null> {
    const idpConfig: IDPConfig = {
      clientId: config.credentials.clientId,
      clientSecret: config.credentials.clientSecret,
      redirectUri: config.credentials.redirectUri,
      ...config.scopes && { scope: config.scopes.join(" ") },
    };

    switch (config.id) {
      case "google":
        return new GoogleProvider(idpConfig);

      case "github":
        return new GitHubProvider(idpConfig);

      default:
        return await this.createGenericProvider(config, idpConfig);
    }
  }

  /**
   * Creates a generic OAuth2/OIDC provider.
   * @param config - Provider configuration.
   * @param idpConfig - Identity provider base configuration.
   * @returns Generic provider instance or null if unsupported.
   */
  private async createGenericProvider(
    config: IIProviderConfig,
    idpConfig: IDPConfig
  ): Promise<IdentityProvider | null> {
    if (config.type !== "oauth2" && config.type !== "oidc") {
      this.logger?.warn(`Unsupported provider type ${config.type} for ${config.id}`);
      return null;
    }

    const genericConfig: Record<string, unknown> = {
      ...idpConfig,
      id: config.id,
      name: config.name,
      authorizationEndpoint: config.endpoints.authorization,
      tokenEndpoint: config.endpoints.token,
      ...config.endpoints.userinfo && { userinfoEndpoint: config.endpoints.userinfo },
      ...this.extractIssuer(config) !== undefined && { issuer: this.extractIssuer(config) },
      ...config.endpoints.jwks && { jwksUri: config.endpoints.jwks },
      ...config.userinfo_mapping && { userinfoMapping: config.userinfo_mapping },
    };

    if (config.type === "oidc" && config.endpoints.discovery) {
      await this.enrichWithDiscovery(genericConfig, config.endpoints.discovery, config.id);
    }

    return new GenericOAuth2Provider(genericConfig as unknown as GenericOAuth2Config);
  }

  /**
   * Extracts issuer URL from OIDC configuration.
   * @param config - Provider configuration.
   * @returns Issuer URL or undefined.
   */
  private extractIssuer(config: IIProviderConfig): string | undefined {
    if (config.type !== "oidc" || !config.endpoints.discovery) {
      return undefined;
    }
    return config.endpoints.discovery.replace("/.well-known/openid-configuration", "");
  }

  /**
   * Enriches provider configuration with OIDC discovery.
   * @param genericConfig - Configuration to enrich.
   * @param discoveryUrl - OIDC discovery endpoint URL.
   * @param providerId - Provider identifier for logging.
   */
  private async enrichWithDiscovery(
    genericConfig: Record<string, unknown>,
    discoveryUrl: string,
    providerId: string
  ): Promise<void> {
    try {
      const discovered = await this.discoverOIDCConfiguration(discoveryUrl);
      Object.assign(genericConfig, discovered);
    } catch (error) {
      this.logger?.warn(`Failed to discover OIDC config for ${providerId}:`, error);
    }
  }

  /**
   * Discovers OIDC configuration from well-known endpoint.
   * @param discoveryUrl - OIDC discovery endpoint URL.
   * @returns Discovered configuration mapped to internal format.
   * @throws Error if discovery fails.
   */
  private async discoverOIDCConfiguration(discoveryUrl: string): Promise<Record<string, string>> {
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC discovery: ${response.statusText}`);
    }

    const config = (await response.json()) as IIOIDCDiscoveryResponse;

    return {
      authorizationendpoint: config.authorizationEndpoint,
      tokenendpoint: config.tokenEndpoint,
      userinfoendpoint: config.userinfo_endpoint || "",
      jwksuri: config.jwks_uri || "",
      issuer: config.issuer,
    };
  }

  /**
   * Gets a provider by ID.
   * @param id - Provider identifier.
   * @returns Provider instance or undefined if not found.
   */
  getProvider(id: string): IdentityProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Gets all enabled providers.
   * @returns Array of all provider instances.
   */
  getAllProviders(): IdentityProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Gets provider configuration.
   * @param id - Provider identifier.
   * @returns Provider configuration or undefined if not found.
   */
  getProviderConfig(id: string): IIProviderConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Checks if a provider is available.
   * @param id - Provider identifier.
   * @returns True if provider exists and is enabled.
   */
  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Lists available provider IDs.
   * @returns Array of provider identifiers.
   */
  listProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Reloads provider configurations.
   * Clears all providers and configurations, then reloads from disk.
   * Useful for dynamic configuration updates.
   * {.
   * @returns Promise that resolves when reload is complete
   * }.
   */
  async reload(): Promise<void> {
    this.providers.clear();
    this.configs.clear();
    await this.initialize();
  }
}
