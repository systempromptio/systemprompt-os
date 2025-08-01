/**
 * URL Configuration Service - Centralized URL management for the system.
 * Manages base URLs, tunnel URLs, and OAuth callback URLs.
 * @module system/services
 */

import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { SystemService } from '@/modules/core/system/services/system.service';
import { SystemConfigType } from '@/modules/core/system/types/index';

/**
 * URL configuration interface.
 */
export interface IUrlConfig {
  baseUrl: string;
  tunnelUrl?: string;
  oauthCallbackBaseUrl: string;
  isSecure: boolean;
  isDevelopment: boolean;
}

/**
 * URL source priority enumeration.
 */
export enum UrlSource {
  TUNNEL = 'tunnel',
  ENVIRONMENT = 'environment',
  CONFIG = 'config',
  DEFAULT = 'default'
}

/**
 * Service for managing system URL configuration.
 * Provides centralized URL management with priority-based resolution.
 */
export class UrlConfigService {
  private static instance: UrlConfigService;
  private systemService?: SystemService;
  private logger?: ILogger;
  private initialized = false;
  private cachedConfig?: IUrlConfig;
  private cacheExpiry?: Date;
  private readonly cacheTimeoutMs = 30000; // 30 seconds
  private static readonly CONFIG_KEYS = {
    BASE_URL: 'system.url.base',
    TUNNEL_URL: 'system.url.tunnel',
    OAUTH_BASE_URL: 'system.url.oauth_base',
    URL_SOURCE: 'system.url.source'
  } as const;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns The URL configuration service instance.
   */
  static getInstance(): UrlConfigService {
    UrlConfigService.instance ||= new UrlConfigService();
    return UrlConfigService.instance;
  }

  /**
   * Initialize the service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.systemService = SystemService.getInstance();

    await this.initializeDefaults();
    this.initialized = true;
    this.logger.info(LogSource.SYSTEM, 'URL Configuration Service initialized');
  }

  /**
   * Get the current URL configuration with priority-based resolution.
   * Priority: 1. Tunnel URL, 2. Environment variables, 3. System config, 4. Defaults.
   * @returns Promise that resolves to the current URL configuration.
   */
  async getUrlConfig(): Promise<IUrlConfig> {
    await this.ensureInitialized();

    if (this.cachedConfig && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cachedConfig;
    }

    const config = await this.resolveUrlConfig();
    this.cachedConfig = config;
    this.cacheExpiry = new Date(Date.now() + this.cacheTimeoutMs);

    return config;
  }

  /**
   * Get the base URL for the system.
   * @returns Promise that resolves to the base URL.
   */
  async getBaseUrl(): Promise<string> {
    const config = await this.getUrlConfig();
    return config.baseUrl;
  }

  /**
   * Get the OAuth callback base URL.
   * @returns Promise that resolves to the OAuth callback base URL.
   */
  async getOAuthCallbackBaseUrl(): Promise<string> {
    const config = await this.getUrlConfig();
    return config.oauthCallbackBaseUrl;
  }

  /**
   * Get the provider callback URL for OAuth2 provider redirects.
   * @param provider - The OAuth2 provider identifier.
   * @returns Promise that resolves to the complete callback URL.
   */
  async getProviderCallbackUrl(provider: string): Promise<string> {
    const baseUrl = await this.getOAuthCallbackBaseUrl();
    return `${baseUrl}/oauth2/callback/${provider}`;
  }

  /**
   * Set the tunnel URL (highest priority).
   * @param tunnelUrl - The tunnel URL to set.
   * @param persist - Whether to persist to system configuration.
   * @returns Promise that resolves when set.
   */
  async setTunnelUrl(tunnelUrl: string, persist = false): Promise<void> {
    await this.ensureInitialized();

    if (persist) {
      await this.systemService!.setConfig(
        UrlConfigService.CONFIG_KEYS.TUNNEL_URL,
        tunnelUrl,
        SystemConfigType.STRING
      );
      await this.systemService!.setConfig(
        UrlConfigService.CONFIG_KEYS.URL_SOURCE,
        UrlSource.TUNNEL,
        SystemConfigType.STRING
      );
    }

    this.clearCache();

    this.logger?.info(LogSource.SYSTEM, `Tunnel URL updated: ${tunnelUrl}`, {
      persist,
      source: UrlSource.TUNNEL
    });
  }

  /**
   * Clear the tunnel URL.
   * @param persist - Whether to persist the change to system configuration.
   * @returns Promise that resolves when cleared.
   */
  async clearTunnelUrl(persist = false): Promise<void> {
    await this.ensureInitialized();

    if (persist) {
      await this.systemService!.deleteConfig(UrlConfigService.CONFIG_KEYS.TUNNEL_URL);
      await this.systemService!.deleteConfig(UrlConfigService.CONFIG_KEYS.URL_SOURCE);
    }

    this.clearCache();
    this.logger?.info(LogSource.SYSTEM, 'Tunnel URL cleared', { persist });
  }

  /**
   * Set the base URL in system configuration.
   * @param baseUrl - The base URL to set.
   * @returns Promise that resolves when set.
   */
  async setBaseUrl(baseUrl: string): Promise<void> {
    await this.ensureInitialized();

    await this.systemService!.setConfig(
      UrlConfigService.CONFIG_KEYS.BASE_URL,
      baseUrl,
      SystemConfigType.STRING
    );

    this.clearCache();
    this.logger?.info(LogSource.SYSTEM, `Base URL updated: ${baseUrl}`);
  }

  /**
   * Check if the system is running in a secure context.
   * @returns Promise that resolves to true if secure.
   */
  async isSecure(): Promise<boolean> {
    const config = await this.getUrlConfig();
    return config.isSecure;
  }

  /**
   * Check if the system is running in development mode.
   * @returns Promise that resolves to true if in development.
   */
  async isDevelopment(): Promise<boolean> {
    const config = await this.getUrlConfig();
    return config.isDevelopment;
  }

  /**
   * Clear the configuration cache.
   */
  clearCache(): void {
    this.cachedConfig = undefined as any;
    this.cacheExpiry = undefined as any;
  }

  /**
   * Resolve the URL configuration with priority-based resolution.
   * @returns Promise that resolves to the resolved URL configuration.
   */
  private async resolveUrlConfig(): Promise<IUrlConfig> {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    const tunnelUrl = await this.getTunnelUrl();
    if (tunnelUrl) {
      return this.buildConfig(tunnelUrl, UrlSource.TUNNEL, isDevelopment);
    }

    const envUrl = process.env.BASE_URL || process.env.OAUTH_BASE_URL;
    if (envUrl?.trim() && envUrl.trim() !== '/') {
      return this.buildConfig(envUrl, UrlSource.ENVIRONMENT, isDevelopment);
    }

    const configUrl = await this.systemService!.getConfig(UrlConfigService.CONFIG_KEYS.BASE_URL);
    if (configUrl && configUrl.trim()) {
      return this.buildConfig(configUrl, UrlSource.CONFIG, isDevelopment);
    }

    const defaultUrl = isDevelopment ? 'http://localhost:3000' : 'https://democontainer.systemprompt.io';
    return this.buildConfig(defaultUrl, UrlSource.DEFAULT, isDevelopment);
  }

  /**
   * Get the tunnel URL from various sources.
   * @returns Promise that resolves to the tunnel URL or null.
   */
  private async getTunnelUrl(): Promise<string | null> {
    const configTunnelUrl = await this.systemService!.getConfig(UrlConfigService.CONFIG_KEYS.TUNNEL_URL);
    if (configTunnelUrl && configTunnelUrl.trim()) {
      return configTunnelUrl;
    }

    const envTunnelUrl = process.env.TUNNEL_URL || process.env.CLOUDFLARE_TUNNEL_URL;
    if (envTunnelUrl?.trim()) {
      return envTunnelUrl;
    }

    return null;
  }

  /**
   * Build URL configuration object.
   * @param baseUrl - The base URL.
   * @param source - The source of the URL.
   * @param isDevelopment - Whether in development mode.
   * @returns The URL configuration object.
   */
  private buildConfig(baseUrl: string, source: UrlSource, isDevelopment: boolean): IUrlConfig {
    const normalizedUrl = this.normalizeUrl(baseUrl);
    const isSecure = normalizedUrl.startsWith('https://');

    this.logger?.debug(LogSource.SYSTEM, 'URL configuration resolved', {
      baseUrl: normalizedUrl,
      source,
      isSecure,
      isDevelopment
    });

    return {
      baseUrl: normalizedUrl,
      ...source === UrlSource.TUNNEL && { tunnelUrl: normalizedUrl },
      oauthCallbackBaseUrl: normalizedUrl,
      isSecure,
      isDevelopment
    };
  }

  /**
   * Normalize URL by removing trailing slashes and ensuring proper protocol.
   * @param url - The URL to normalize.
   * @returns The normalized URL.
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim();

    if (!normalized) {
      return normalized;
    }

    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Initialize default configurations.
   * @returns Promise that resolves when initialized.
   */
  private async initializeDefaults(): Promise<void> {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const defaultBaseUrl = isDevelopment ? 'http://localhost:3000' : 'https://democontainer.systemprompt.io';

    const existingBaseUrl = await this.systemService!.getConfig(UrlConfigService.CONFIG_KEYS.BASE_URL);
    if (!existingBaseUrl) {
      await this.systemService!.setConfig(
        UrlConfigService.CONFIG_KEYS.BASE_URL,
        defaultBaseUrl,
        SystemConfigType.STRING
      );
    }
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
