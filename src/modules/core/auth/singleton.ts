import type { IModule } from '@/modules/core/modules/types/index.js';
import type { AuthModuleExports, IdentityProvider } from '@/modules/core/auth/types/index.js';
import type { ProviderRegistry } from '@/modules/core/auth/providers/registry.js';
import { getModuleLoader } from '@/modules/loader.js';

/**
 *
 * AuthModuleWithExports interface.
 *
 */

export interface IAuthModuleWithExports extends IModule {
  exports: AuthModuleExports;
  getProvider(providerId: string): IdentityProvider | undefined;
  getAllProviders(): IdentityProvider[];
  hasProvider(providerId: string): boolean;
  getProviderRegistry(): ProviderRegistry | null;
  reloadProviders(): Promise<void>;
  getTunnelStatus(): unknown;
  getPublicUrl(): string | null;
}

export function getAuthModule(): AuthModuleWithExports {
  const moduleLoader = getModuleLoader();
  const authModule = moduleLoader.getModule('auth');

  if (authModule === undefined) {
    throw new Error('Auth module not loaded');
  }

  return authModule as AuthModuleWithExports;
}
