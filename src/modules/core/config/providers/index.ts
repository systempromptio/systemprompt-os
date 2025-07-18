/**
 * @fileoverview Provider registry for AI providers
 * @module modules/core/config/providers
 */

import { googleLiveAPIProvider } from './google.js';
import type { ProviderConfig, ProviderRegistry } from '../types/provider.js';

/**
 * Registry of all available AI providers
 */
export const providers: Record<string, ProviderConfig> = {
  'google-liveapi': googleLiveAPIProvider
  // Future providers can be added here:
  // 'openai': openAIProvider,
  // 'anthropic': anthropicProvider,
  // 'local-llm': localLLMProvider
};

/**
 * Provider registry configuration
 */
export const providerRegistry: ProviderRegistry = {
  availableProviders: Object.keys(providers),
  enabledProviders: Object.keys(providers).filter(name => providers[name].enabled),
  defaultProvider: 'google-liveapi'
};

/**
 * Get a provider configuration by name
 */
export function getProvider(name: string): ProviderConfig | undefined {
  return providers[name];
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): ProviderConfig[] {
  return providerRegistry.enabledProviders.map(name => providers[name]).filter(Boolean);
}

/**
 * Get the default provider
 */
export function getDefaultProvider(): ProviderConfig | undefined {
  return providers[providerRegistry.defaultProvider];
}

/**
 * Enable a provider
 */
export function enableProvider(name: string): boolean {
  if (providers[name]) {
    providers[name].enabled = true;
    providerRegistry.enabledProviders = Object.keys(providers).filter(n => providers[n].enabled);
    return true;
  }
  return false;
}

/**
 * Disable a provider
 */
export function disableProvider(name: string): boolean {
  if (providers[name]) {
    providers[name].enabled = false;
    providerRegistry.enabledProviders = Object.keys(providers).filter(n => providers[n].enabled);
    return true;
  }
  return false;
}

/**
 * Set the default provider
 */
export function setDefaultProvider(name: string): boolean {
  if (providers[name] && providers[name].enabled) {
    providerRegistry.defaultProvider = name;
    return true;
  }
  return false;
}