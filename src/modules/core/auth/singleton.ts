import type { IModule } from '@/modules/core/modules/types/index';
import type { AuthModuleExports, IdentityProvider } from '@/modules/core/auth/types/index';
import type { ProviderRegistry } from '@/modules/core/auth/providers/registry';
import { getModuleLoader } from '@/modules/loader';
import { ModuleName } from '@/modules/types/module-names.types';

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
  start(): Promise<void>;
}

export function getAuthModule(): IAuthModuleWithExports {
  const moduleLoader = getModuleLoader();
  const authModule = moduleLoader.getModule(ModuleName.AUTH);

  if (authModule === undefined) {
    throw new Error('Auth module not loaded');
  }

  return authModule as unknown as IAuthModuleWithExports;
}
