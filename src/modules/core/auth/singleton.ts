/**
 * @file Auth Module Singleton.
 * @module modules/core/auth/singleton
 * Provides a singleton instance of the auth module for server usage
 */

import type { IModule } from '@/modules/core/modules/types/index.js';
import type { AuthModuleExports, IdentityProvider } from '@/modules/core/auth/types/index.js';
import type { ProviderRegistry } from '@/modules/core/auth/providers/registry.js';
import { getModuleLoader } from '@/modules/loader.js';

export interface AuthModuleWithExports extends IModule {
  exports: AuthModuleExports;
  getProvider(providerId: string): IdentityProvider | undefined;
  getAllProviders(): IdentityProvider[];
  hasProvider(providerId: string): boolean;
  getProviderRegistry(): ProviderRegistry | null;
  reloadProviders(): Promise<void>;
  getTunnelStatus(): any;
  getPublicUrl(): string | null;
}

/**
 * Get the auth module singleton instance from the module loader.
 */
export function getAuthModule(): AuthModuleWithExports {
  const moduleLoader = getModuleLoader();
  const authModule = moduleLoader.getModule('auth');

  if (!authModule) {
    throw new Error('Auth module not loaded');
  }

  return authModule as AuthModuleWithExports;
}
