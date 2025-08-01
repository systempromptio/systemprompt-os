/**
 * Provider management service for configuration module.
 * Handles provider registration, enabling/disabling, and configuration management.
 * @file Provider management service.
 * @module modules/core/config/services/providers
 */

import type { IProvider } from '@/modules/core/config/types/manual';

/**
 * Global providers configuration object.
 */
const providers: Record<string, IProvider> = {};

/**
 * Provider registry for tracking default and enabled providers.
 */
const providerRegistry = {
  defaultProvider: 'google-liveapi',
  enabledProviders: ['google-liveapi']
};

/**
 * Provider management service providing centralized provider operations.
 */
export class ProvidersService {
  private static instance: ProvidersService | null = null;

  /**
   * Get singleton instance of ProvidersService.
   * @returns ProvidersService instance.
   */
  public static getInstance(): ProvidersService {
    if (ProvidersService.instance === null) {
      ProvidersService.instance = new ProvidersService();
    }
    return ProvidersService.instance;
  }

  /**
   * Get all enabled providers.
   * @returns Array of enabled provider objects.
   */
  public getEnabledProviders(): IProvider[] {
    return Object.values(providers).filter((provider): boolean => { return provider.enabled });
  }

  /**
   * Get a specific provider by name.
   * @param name - Provider name.
   * @returns Provider object or null if not found.
   */
  public getProvider(name: string): IProvider | null {
    return providers[name] ?? null;
  }

  /**
   * Get all providers.
   * @returns Record of all providers.
   */
  public getProviders(): Record<string, IProvider> {
    return { ...providers };
  }

  /**
   * Get provider registry.
   * @returns Provider registry object.
   */
  public getProviderRegistry(): typeof providerRegistry {
    return { ...providerRegistry };
  }

  /**
   * Register a new provider.
   * @param provider - Provider configuration.
   */
  public registerProvider(provider: IProvider): void {
    providers[provider.name] = provider;
  }

  /**
   * Enable a provider.
   * @param name - Provider name.
   * @returns True if successful, false otherwise.
   */
  public enableProvider(name: string): boolean {
    const provider = providers[name];
    if (provider === null || provider === undefined) {
      return false;
    }

    provider.enabled = true;

    if (!providerRegistry.enabledProviders.includes(name)) {
      providerRegistry.enabledProviders.push(name);
    }

    return true;
  }

  /**
   * Disable a provider.
   * @param name - Provider name.
   * @returns True if successful, false otherwise.
   */
  public disableProvider(name: string): boolean {
    const provider = providers[name];
    if (provider === null || provider === undefined) {
      return false;
    }

    provider.enabled = false;

    const index = providerRegistry.enabledProviders.indexOf(name);
    if (index > -1) {
      providerRegistry.enabledProviders.splice(index, 1);
    }

    return true;
  }

  /**
   * Set default provider.
   * @param name - Provider name.
   * @returns True if successful, false otherwise.
   */
  public setDefaultProvider(name: string): boolean {
    const provider = providers[name];
    if (provider === null || provider === undefined || !provider.enabled) {
      return false;
    }

    providerRegistry.defaultProvider = name;
    return true;
  }
}
