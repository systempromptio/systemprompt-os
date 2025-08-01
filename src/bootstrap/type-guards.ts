/**
 * Type guards for bootstrap module type safety.
 * @file Type guards for bootstrap module type safety.
 * @module bootstrap/type-guards
 */

import type { IModulesModuleExports } from '../modules/core/modules/types/manual';

/**
 * Type guard to check if an object is a valid IModulesModuleExports.
 * @param {unknown} obj - Object to check.
 * @returns {obj is IModulesModuleExports} True if object is IModulesModuleExports.
 */
export const isModuleExports = (obj: unknown): obj is IModulesModuleExports => {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj !== 'object') {
    return false;
  }

  const hasValidScanForModules = 'scanForModules' in obj
    && typeof obj.scanForModules === 'function';

  const hasValidGetEnabledModules = 'getEnabledModules' in obj
    && typeof obj.getEnabledModules === 'function';

  return hasValidScanForModules && hasValidGetEnabledModules;
};

/**
 * Assert that an object is a valid IModulesModuleExports.
 * @param {unknown} obj - Object to check.
 * @throws {Error} If object is not a valid IModulesModuleExports.
 * @returns {asserts obj is IModulesModuleExports} Type assertion.
 */
export const assertModuleExports = (obj: unknown): asserts obj is IModulesModuleExports => {
  if (!isModuleExports(obj)) {
    throw new Error(
      'Invalid module exports: missing required methods scanForModules or getEnabledModules',
    );
  }
};
