import {
 existsSync, readFileSync, readdirSync
} from "fs";
import { extname, join } from "path";
import { parse as parseYaml } from "yaml";
import type { ILogger } from "@/modules/core/logger/types/index";
import { LogSource } from "@/modules/core/logger/types/index";
import type {
  IdpConfig as IDPConfig,
  IIdentityProvider
} from '@/modules/core/auth/types/provider-interface';
import { GenericOAuth2Provider } from '@/modules/core/auth/providers/core/oauth2';
import type {
  IGenericOAuth2Config,
  IOIDCDiscoveryConfig
} from '@/modules/core/auth/types/oauth2.types';
import { GoogleProvider } from '@/modules/core/auth/providers/core/google';
import { GitHubProvider } from '@/modules/core/auth/providers/core/github';
import type { ProviderConfig } from '@/modules/core/auth/providers/types';

/**
 * ProviderRegistry manages OAuth2/OIDC identity provider configurations.
 * This class handles loading provider configurations from YAML files,
 * instantiating provider implementations, and managing the provider registry.
 * It supports both built-in providers (Google, GitHub) and generic OAuth2/OIDC providers.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, IIdentityProvider>();
  private readonly configs = new Map<string, ProviderConfig>();
  private readonly logger?: ILogger;
  private readonly configPath: string;

  /**
   * Creates a new ProviderRegistry instance.
   * @param configPath - Base path for provider configuration files.
   * @param logger - Optional logger instance for debugging.
   */
  constructor(configPath: string, logger?: ILogger) {
    this.configPath = configPath;
    if (logger != null) {
      this.logger = logger;
    }
  }

  /**
   * Initializes the registry by loading and instantiating all providers.
   * @returns Promise that resolves when initialization is complete.
   * @throws Error if critical initialization failure occurs.
   */
  async initialize(): Promise<void> {
    await this.loadProviderConfigs();
    await this.instantiateProviders();
  }

  /**
   * Loads provider configurations from YAML files.
   * Scans the providers directory for YAML files and loads configurations.
   * For enabled providers. Also checks for custom providers in a subdirectory.
   */
  private async loadProviderConfigs(): Promise<void> {
    const { configPath: providersPath } = this;

    this.logger?.info(LogSource.AUTH, `Looking for providers in: ${providersPath}`);

    if (!existsSync(providersPath)) {
      this.logger?.warn(LogSource.AUTH, `Providers directory not found: ${providersPath}`);
      return;
    }

    const yamlFiles = readdirSync(providersPath).filter(
      (file): boolean => {
        return [".yaml", ".yml"].includes(extname(file)) && file !== "template.yaml";
      },
    );

    await this.loadProviderFiles(
      yamlFiles.map((file): string => {
        return join(providersPath, file);
      })
    );
    await this.loadCustomProviders(providersPath);
  }

  /**
   * Loads custom provider configurations.
   * @param basePath - Base providers directory path.
   */
  private async loadCustomProviders(basePath: string): Promise<void> {
    const customPath = join(basePath, "custom");

    if (!existsSync(customPath)) {
      return;
    }

    const customFiles = readdirSync(customPath)
      .filter((file): boolean => {
        return [".yaml", ".yml"].includes(extname(file));
      })
      .map((file): string => {
        return join(customPath, file);
      });

    await this.loadProviderFiles(customFiles, true);
  }

  /**
   * Loads provider configuration files.
   * @param filePaths - Array of file paths to load.
   * @param isCustom - Whether these are custom provider files.
   */
  private async loadProviderFiles(filePaths: string[], isCustom = false): Promise<void> {
    const loadPromises = filePaths.map(async (filePath): Promise<void> => {
      try {
        const config = this.loadProviderConfig(filePath);
        if (config != null && config.enabled) {
          this.configs.set(config.id, config);
          const providerType = isCustom ? "custom provider" : "provider";
          this.logger?.info(LogSource.AUTH, `Loaded ${providerType} config: ${config.id}`);
        }
      } catch (error) {
        this.logger?.error(
          LogSource.AUTH,
          `Failed to load provider config ${filePath}`,
          {
            error: error instanceof Error ? error : new Error(String(error))
          }
        );
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Loads a single provider configuration file.
   * @param filePath - Path to the YAML configuration file.
   * @returns Parsed and validated provider configuration or null if invalid.
   */
  private loadProviderConfig(filePath: string): ProviderConfig | null {
    const content = readFileSync(filePath, "utf8");
    const rawConfig: unknown = parseYaml(content);
    const config = this.substituteEnvVars(rawConfig);

    if (!this.isValidProviderConfig(config)) {
      this.logger?.warn(
        LogSource.AUTH,
        `Skipping provider config ${filePath}: missing required fields`
      );
      return null;
    }

    if (
      config.credentials?.clientId != null
      && config.credentials.clientId.trim() !== ''
      && config.credentials.clientSecret != null
      && config.credentials.clientSecret.trim() !== ''
    ) {
      config.enabled = true;
    }

    return config;
  }

  /**
   * Validates provider configuration.
   * @param config - Configuration to validate.
   * @returns True if configuration has all required fields.
   */
  private isValidProviderConfig(config: unknown): config is ProviderConfig {
    const providerConfig = config as Partial<ProviderConfig>;
    return Boolean(
      providerConfig.id != null
      && providerConfig.id.trim() !== ''
      && providerConfig.credentials?.clientId != null
      && providerConfig.credentials.clientId.trim() !== ''
      && providerConfig.credentials.clientSecret != null
      && providerConfig.credentials.clientSecret.trim() !== ''
    );
  }

  /**
   * Recursively substitutes environment variables in configuration.
   * @param obj - Object to process.
   * @returns Object with environment variables substituted.
   */
  private substituteEnvVars(obj: unknown): unknown {
    if (typeof obj === "string") {
      return obj.replace(/\$\{(?<envVar>[^}]+)\}/gu, (match, varName: string): string => {
        if (varName === "OAUTH_REDIRECT_URI" && process.env.BASE_URL != null) {
          return `${process.env.BASE_URL}/oauth2/callback`;
        }
        return process.env[varName] ?? match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item): unknown => {
        return this.substituteEnvVars(item);
      });
    }

    if (obj != null && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Instantiates provider implementations from configurations.
   * Creates provider instances for all loaded configurations.
   */
  private async instantiateProviders(): Promise<void> {
    const instantiationPromises = Array.from(this.configs.entries()).map(
      async ([id, config]): Promise<void> => {
        try {
          const provider = await this.createProvider(config);
          if (provider != null) {
            this.providers.set(id, provider);
            this.logger?.info(LogSource.AUTH, `Instantiated provider: ${id}`);
          }
        } catch (error) {
          this.logger?.error(
            LogSource.AUTH,
            `Failed to instantiate provider ${id}`,
            {
              error: error instanceof Error ? error : new Error(String(error))
            }
          );
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
  private async createProvider(config: ProviderConfig): Promise<IIdentityProvider | null> {
    const idpConfig: IDPConfig = {
      clientId: config.credentials.clientId,
      clientSecret: config.credentials.clientSecret,
      redirectUri: config.credentials.redirectUri,
      ...config.scopes && config.scopes.length > 0 ? { scope: config.scopes.join(" ") } : {},
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
    config: ProviderConfig,
    idpConfig: IDPConfig
  ): Promise<IIdentityProvider | null> {
    if (config.type !== "oauth2" && config.type !== "oidc") {
      this.logger?.warn(
        LogSource.AUTH,
        `Unsupported provider type ${config.type} for ${config.id}`
      );
      return null;
    }

    const genericConfig: IGenericOAuth2Config = {
      id: config.id,
      name: config.name,
      clientId: idpConfig.clientId,
      clientSecret: idpConfig.clientSecret,
      redirectUri: idpConfig.redirectUri,
      authorizationEndpoint: config.endpoints.authorization,
      tokenEndpoint: config.endpoints.token,
      ...idpConfig.scope ? { scope: idpConfig.scope } : {},
      ...config.endpoints.userinfo && config.endpoints.userinfo.trim() !== '' ? {
        userinfoEndpoint: config.endpoints.userinfo
      } : {},
      ...(() => {
        const issuer = this.extractIssuer(config);
        return issuer ? { issuer } : {};
      })(),
      ...config.endpoints.jwks && config.endpoints.jwks.trim() !== '' ? {
        jwksUri: config.endpoints.jwks
      } : {},
      ...config.userinfoMapping ? {
        userinfoMapping: config.userinfoMapping
      } : {},
    };

    if (
      config.type === "oidc"
      && config.endpoints.discovery
      && config.endpoints.discovery.trim() !== ''
    ) {
      await this.enrichWithDiscovery(
        genericConfig,
        config.endpoints.discovery,
        config.id
      );
    }

    return new GenericOAuth2Provider(genericConfig);
  }

  /**
   * Extracts issuer URL from OIDC configuration.
   * @param config - Provider configuration.
   * @returns Issuer URL or undefined.
   */
  private extractIssuer(config: ProviderConfig): string | undefined {
    if (
      config.type !== "oidc"
      || !config.endpoints.discovery
      || config.endpoints.discovery.trim() === ''
    ) {
      return undefined;
    }
    return config.endpoints.discovery.replace(
      "/.well-known/openid-configuration",
      ""
    );
  }

  /**
   * Enriches provider configuration with OIDC discovery.
   * @param genericConfig - Configuration to enrich.
   * @param discoveryUrl - OIDC discovery endpoint URL.
   * @param providerId - Provider identifier for logging.
   */
  private async enrichWithDiscovery(
    genericConfig: IGenericOAuth2Config,
    discoveryUrl: string,
    providerId: string
  ): Promise<void> {
    try {
      const discovered = await this.discoverOidcConfiguration(discoveryUrl);
      Object.assign(genericConfig, discovered);
    } catch (error) {
      this.logger?.warn(
        LogSource.AUTH,
        `Failed to discover OIDC config for ${providerId}`,
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Discovers OIDC configuration from well-known endpoint.
   * @param discoveryUrl - OIDC discovery endpoint URL.
   * @returns Discovered configuration mapped to internal format.
   * @throws Error if discovery fails.
   */
  private async discoverOidcConfiguration(
    discoveryUrl: string
  ): Promise<Partial<IGenericOAuth2Config>> {
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC discovery: ${response.statusText}`);
    }

    const config = (await response.json()) as IOIDCDiscoveryConfig;

    return {
      authorizationEndpoint: config.authorization_endpoint,
      tokenEndpoint: config.token_endpoint,
      userinfoEndpoint: config.userinfo_endpoint,
      jwksUri: config.jwks_uri,
      issuer: config.issuer,
      scopesSupported: config.scopes_supported,
      responseTypesSupported: config.response_types_supported,
      grantTypesSupported: config.grant_types_supported,
      tokenEndpointAuthMethods: config.token_endpoint_auth_methods_supported,
    };
  }

  /**
   * Gets a provider by ID.
   * @param id - Provider identifier.
   * @returns Provider instance or undefined if not found.
   */
  getProvider(id: string): IIdentityProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Gets all enabled providers.
   * @returns Array of all provider instances.
   */
  getAllProviders(): IIdentityProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Gets provider configuration.
   * @param id - Provider identifier.
   * @returns Provider configuration or undefined if not found.
   */
  getProviderConfig(id: string): ProviderConfig | undefined {
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
   * @returns Promise that resolves when reload is complete.
   */
  async reload(): Promise<void> {
    this.providers.clear();
    this.configs.clear();
    await this.initialize();
  }
}
