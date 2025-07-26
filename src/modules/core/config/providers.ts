/**
 * Provider configuration types.
 */
export interface Provider {
  name: string;
  displayName: string;
  enabled: boolean;
  config?: any;
}

/**
 * Global providers configuration object.
 */
export const providers: Record<string, Provider> = {};

/**
 * Provider registry for tracking default and enabled providers.
 */
export const providerRegistry = {
  defaultProvider: 'google-liveapi',
  enabledProviders: ['google-liveapi']
};

/**
 * Get all enabled providers.
 * @returns {Array} Array of enabled provider objects.
 */
export function getEnabledProviders(): Provider[] {
  return Object.values(providers).filter(provider => { return provider && provider.enabled });
}

/**
 * Get a specific provider by name.
 * @param {string} name - Provider name.
 * @returns {Object|null} Provider object or null if not found.
 */
export function getProvider(name: string): Provider | null {
  return providers[name] || null;
}

/**
 * Enable a provider.
 * @param {string} name - Provider name.
 * @returns {boolean} True if successful, false otherwise.
 */
export function enableProvider(name: string): boolean {
  const provider = providers[name];
  if (!provider) {
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
 * @param {string} name - Provider name.
 * @returns {boolean} True if successful, false otherwise.
 */
export function disableProvider(name: string): boolean {
  const provider = providers[name];
  if (!provider) {
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
 * @param {string} name - Provider name.
 * @returns {boolean} True if successful, false otherwise.
 */
export function setDefaultProvider(name: string): boolean {
  const provider = providers[name];
  if (!provider || !provider.enabled) {
    return false;
  }

  providerRegistry.defaultProvider = name;
  return true;
}
