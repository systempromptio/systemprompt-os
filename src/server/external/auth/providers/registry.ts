/**
 * @file Identity Provider Registry.
 * @module server/external/auth/providers/registry
 * This file now delegates to the auth module for provider management
 */

import { getProviderRegistry as getAuthModuleRegistry } from '@/server/external/auth/providers/auth-module-adapter.js';

/**
 * Get the provider registry from the auth module
 * This function delegates to the auth module's provider management.
 */
export function getProviderRegistry() {
  return getAuthModuleRegistry();
}
