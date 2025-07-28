/**
 * Auth module helper utilities.
 */

import { type IModule } from '@/modules/core/modules/types/index';
import { getModuleLoader } from '@/modules/loader';
import { ModuleName } from '@/modules/types/module-names.types';
import type { IAuthModuleExports } from '@/modules/core/auth/types/index';

/**
 * Validate auth module exports.
 * @param authModule - Module to validate.
 * @throws {Error} If module is invalid.
 */
export function validateAuthModule(
  authModule: IModule<IAuthModuleExports>
): asserts authModule is IModule<IAuthModuleExports> {
  if (!authModule.exports) {
    throw new Error('Auth module not properly initialized');
  }

  const requiredExports = [
    'service',
    'tokenService',
    'userService',
    'createToken',
    'validateToken'
  ] as const;

  for (const exportName of requiredExports) {
    if (typeof authModule.exports[exportName] !== 'function') {
      throw new Error(`Auth module missing required ${exportName} export`);
    }
  }
}

/**
 * Gets the Auth module with type safety and validation.
 * @returns The Auth module with guaranteed typed exports.
 * @throws {Error} If Auth module is not available or missing required exports.
 */
export const getAuthModule = (): IModule<IAuthModuleExports> => {
  const moduleLoader = getModuleLoader();
  const registry = moduleLoader.getRegistry();
  const authModules = registry.getAll().filter((module): boolean => {
    return module.name === ModuleName.AUTH;
  });

  if (authModules.length === 0) {
    throw new Error('Auth module not found in registry');
  }

  const authModule = authModules[0] as IModule<IAuthModuleExports>;
  validateAuthModule(authModule);

  return authModule;
};
