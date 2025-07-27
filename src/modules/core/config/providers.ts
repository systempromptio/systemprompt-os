/**
 * Provider configuration types.
 */
export interface IProvider {
  name: string;
  displayName: string;
  enabled: boolean;
  config?: unknown;
}

/**
 * Global providers configuration object.
 */
export const providers: Record<string, IProvider> = {};

/**
 * Provider registry for tracking default and enabled providers.
 */
export const providerRegistry = {
  defaultProvider: 'google-liveapi',
  enabledProviders: ['google-liveapi']
};

/**
 * Get all enabled providers.
 * @returns Array of enabled provider objects.
 */
export const getEnabledProviders = (): IProvider[] => {
  return Object.values(providers).filter((provider): boolean => { return provider.enabled });
};

/**
 * Get a specific provider by name.
 * @param name - Provider name.
 * @returns Provider object or null if not found.
 */
export const getProvider = (name: string): IProvider | null => {
  return providers[name] ?? null;
};

/**
 * Enable a provider.
 * @param name - Provider name.
 * @returns True if successful, false otherwise.
 */
export const enableProvider = (name: string): boolean => {
  const { [name]: provider } = providers;
  if (provider === null || provider === undefined) {
    return false;
  }

  provider.enabled = true;

  if (!providerRegistry.enabledProviders.includes(name)) {
    providerRegistry.enabledProviders.push(name);
  }

  return true;
};

/**
 * Disable a provider.
 * @param name - Provider name.
 * @returns True if successful, false otherwise.
 */
export const disableProvider = (name: string): boolean => {
  const { [name]: provider } = providers;
  if (provider === null || provider === undefined) {
    return false;
  }

  provider.enabled = false;

  const index = providerRegistry.enabledProviders.indexOf(name);
  if (index > -1) {
    providerRegistry.enabledProviders.splice(index, 1);
  }

  return true;
};

/**
 * Set default provider.
 * @param name - Provider name.
 * @returns True if successful, false otherwise.
 */
export const setDefaultProvider = (name: string): boolean => {
  const { [name]: provider } = providers;
  if (provider === null || provider === undefined || !provider.enabled) {
    return false;
  }

  providerRegistry.defaultProvider = name;
  return true;
};
