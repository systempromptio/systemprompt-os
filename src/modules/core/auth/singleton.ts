/**
 * @fileoverview Auth Module Singleton
 * @module modules/core/auth/singleton
 * 
 * Provides a singleton instance of the auth module for server usage
 */

import { AuthModule } from './index.js';

let authModuleInstance: AuthModule | null = null;

/**
 * Get or create the auth module singleton instance
 */
export function getAuthModule(): AuthModule {
  if (!authModuleInstance) {
    authModuleInstance = new AuthModule();
  }
  return authModuleInstance;
}

/**
 * Initialize the auth module singleton with context
 */
export async function initializeAuthModule(context: { config?: any; logger?: any }): Promise<AuthModule> {
  const module = getAuthModule();
  await module.initialize(context);
  await module.start();
  return module;
}