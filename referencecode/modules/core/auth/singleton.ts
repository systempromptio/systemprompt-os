/**
 * @fileoverview Auth Module Singleton
 * @module modules/core/auth/singleton
 *
 * Provides a singleton instance of the auth module for server usage
 */

import type { AuthModule } from './index.js';
import { getModuleLoader } from '../../../modules/loader.js';

/**
 * Get the auth module singleton instance from the module loader
 */
export function getAuthModule(): AuthModule {
  const moduleLoader = getModuleLoader();
  const authModule = moduleLoader.getModule('auth');

  if (!authModule) {
    throw new Error('Auth module not loaded');
  }

  return authModule as unknown as AuthModule;
}