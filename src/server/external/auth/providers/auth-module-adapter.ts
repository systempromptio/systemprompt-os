/**
 * @file Auth Module Adapter for Provider Registry.
 * @module server/external/auth/providers/auth-module-adapter
 * This adapter allows the server to use providers from the auth module
 * while maintaining the existing provider registry interface
 */

import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface';
import type { IIdentityProvider } from '@/server/external/rest/oauth2/types/authorize.types';
import { getAuthModule } from '@/modules/core/auth/index';

/**
 * Adapter that wraps auth module providers to match server interface.
 */
class ProviderAdapter implements IIdentityProvider {
  constructor(private readonly authProvider: IdentityProvider) {}

  get name(): string {
    return this.authProvider.id;
  }

  getAuthorizationUrl(state: string): string {
    return this.authProvider.getAuthorizationUrl(state);
  }

  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string }> {
    const tokens = await this.authProvider.exchangeCodeForTokens(code);
    return { accessToken: tokens.accessToken };
  }

  async getUserInfo(token: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: Record<string, unknown>;
  }> {
    const userInfo = await this.authProvider.getUserInfo(token);
    const result: {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
      raw?: Record<string, unknown>;
    } = {
      id: userInfo.id
    };

    if (userInfo.email !== undefined) {
      result.email = userInfo.email;
    }
    if (userInfo.name !== undefined) {
      result.name = userInfo.name;
    }
    if (userInfo.picture !== undefined) {
      result.picture = userInfo.picture;
    }
    if (userInfo.raw !== undefined) {
      result.raw = userInfo.raw;
    }

    return result;
  }
}

export class AuthModuleProviderRegistry {
  /**
   * Get a provider by ID from the auth module.
   * @param providerId
   */
  get(providerId: string): IIdentityProvider | undefined {
    const authModule = getAuthModule();
    const provider = authModule.exports.getProvider(providerId);
    return provider ? new ProviderAdapter(provider as IdentityProvider) : undefined;
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
    const providers = authModule.exports.getAllProviders();
    return providers.map((provider) => { return new ProviderAdapter(provider as IdentityProvider) });
  }

  /**
   * Get all providers (alias for compatibility).
   */
  getAllProviders(): IIdentityProvider[] {
    return this.list();
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
