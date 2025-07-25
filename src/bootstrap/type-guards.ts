/**
 * Type guards for bootstrap module type safety.
 * @file Type guards for bootstrap module type safety.
 * @module bootstrap/type-guards
 */

import type { IModuleExports } from '@/types/bootstrap-module';

/**
 * Type guard to check if an object is a valid IModuleExports.
 * @param {unknown} obj - Object to check.
 * @returns {obj is IModuleExports} True if object is IModuleExports.
 */
export const isModuleExports = (obj: unknown): obj is IModuleExports => {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    'scanForModules' in candidate
    && typeof candidate.scanForModules === 'function'
    && 'getEnabledModules' in candidate
    && typeof candidate.getEnabledModules === 'function'
  );
};

/**
 * Assert that an object is a valid IModuleExports.
 * @param {unknown} obj - Object to check.
 * @throws {Error} If object is not a valid IModuleExports.
 * @returns {asserts obj is IModuleExports} Type assertion.
 */
export const assertModuleExports = (obj: unknown): asserts obj is IModuleExports => {
  if (!isModuleExports(obj)) {
    throw new Error(
      'Invalid module exports: missing required methods scanForModules or getEnabledModules',
    );
  }
};
