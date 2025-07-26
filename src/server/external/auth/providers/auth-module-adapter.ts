/**
 * @file Auth Module Adapter for Provider Registry.
 * @module server/external/auth/providers/auth-module-adapter
 * This adapter allows the server to use providers from the auth module
 * while maintaining the existing provider registry interface
 */

import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface';
import { getAuthModule } from '@/modules/core/auth/singleton';

export class AuthModuleProviderRegistry {
  /**
   * Get a provider by ID from the auth module.
   * @param providerId
   */
  get(providerId: string): IdentityProvider | undefined {
    const authModule = getAuthModule();
    const provider = authModule.exports.getProvider(providerId);
    return provider as IdentityProvider | undefined;
  }

  /**
   * List all providers from the auth module.
   */
  list(): IdentityProvider[] {
    const authModule = getAuthModule();
    const providers = authModule.exports.getAllProviders();
    return providers as IdentityProvider[];
  }

  /**
   * Check if a provider exists in the auth module.
   * @param providerId
   */
  has(providerId: string): boolean {
    const authModule = getAuthModule();
    return authModule.exports.hasProvider?.(providerId) ?? false;
  }

  /**
   * Register method - no-op since providers are managed by the auth module.
   * @param _provider
   */
  register(_provider: IdentityProvider): void {
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
