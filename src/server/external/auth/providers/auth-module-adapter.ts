/**
 * @file Auth Module Adapter for Provider Registry.
 * @module server/external/auth/providers/auth-module-adapter
 * This adapter allows the server to use providers from the auth module
 * while maintaining the existing provider registry interface
 */

import type { IIdentityProvider } from '@/server/external/rest/oauth2/types/authorize.types';
import { getAuthModule } from '@/modules/core/auth/index';

export class AuthModuleProviderRegistry {
  /**
   * Get a provider by ID from the auth module.
   * @param providerId
   */
  get(providerId: string): IIdentityProvider | undefined {
    const authModule = getAuthModule();
    const providerService = authModule.exports.providersService();
    return providerService.getProviderInstance(providerId);
  }

  /**
   * Get a provider by ID (alias for compatibility).
   * @param providerId
   */
  getProvider(providerId: string): IIdentityProvider | undefined {
    return this.get(providerId);
  }

  /**
   * List all providers from the auth module.
   */
  list(): IIdentityProvider[] {
    const authModule = getAuthModule();
    const providerService = authModule.exports.providersService();
    return providerService.getAllProviderInstances();
  }

  /**
   * Get all providers (alias for compatibility).
   */
  getAllProviders(): IIdentityProvider[] {
    const authModule = getAuthModule();
    const providerService = authModule.exports.providersService();
    return providerService.getAllProviderInstances();
  }

  /**
   * Check if a provider exists in the auth module.
   * @param providerId
   */
  has(providerId: string): boolean {
    const authModule = getAuthModule();
    const providerService = authModule.exports.providersService();
    return providerService.hasProvider(providerId);
  }

  /**
   * Register method - no-op since providers are managed by the auth module.
   * @param _provider
   */
  register(_provider: IIdentityProvider): void {
    console.warn('Provider registration is now managed by the auth module configuration files');
  }
}

// Singleton instance
let registry: AuthModuleProviderRegistry | null = null;

/**
 * Get the provider registry that uses the auth module.
 */
export function getProviderRegistry(): AuthModuleProviderRegistry {
  registry ||= new AuthModuleProviderRegistry();
  return registry;
}
