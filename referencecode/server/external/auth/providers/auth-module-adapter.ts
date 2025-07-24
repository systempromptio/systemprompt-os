/**
 * @fileoverview Auth Module Adapter for Provider Registry
 * @module server/external/auth/providers/auth-module-adapter
 *
 * This adapter allows the server to use providers from the auth module
 * while maintaining the existing provider registry interface
 */

import type { IdentityProvider } from './interface.js';
import { getAuthModule } from '../../../../modules/core/auth/singleton.js';

export class AuthModuleProviderRegistry {
  /**
   * Get a provider by ID from the auth module
   */
  get(providerId: string): IdentityProvider | undefined {
    const authModule = getAuthModule();
    return authModule.getProvider(providerId);
  }

  /**
   * List all providers from the auth module
   */
  list(): IdentityProvider[] {
    const authModule = getAuthModule();
    return authModule.getAllProviders();
  }

  /**
   * Check if a provider exists in the auth module
   */
  has(providerId: string): boolean {
    const authModule = getAuthModule();
    return authModule.hasProvider(providerId);
  }

  /**
   * Register method - no-op since providers are managed by the auth module
   */
  register(_provider: IdentityProvider): void {
    console.warn('Provider registration is now managed by the auth module configuration files');
  }
}

// Singleton instance
let registry: AuthModuleProviderRegistry | null = null;

/**
 * Get the provider registry that uses the auth module
 */
export function getProviderRegistry(): AuthModuleProviderRegistry {
  if (!registry) {
    registry = new AuthModuleProviderRegistry();
  }
  return registry;
}