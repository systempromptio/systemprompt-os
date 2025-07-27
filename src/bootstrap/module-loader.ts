/**
 * Module loading utilities for bootstrap.
 * @file Module loading utilities for bootstrap.
 * @module bootstrap/module-loader
 */

import type { IModule } from '@/modules/core/modules/types/index';
import type {
  ICoreModuleDefinition,
} from '@/types/bootstrap';
import type { ModuleConstructor } from '@/types/bootstrap-module';
import { MIN_MODULE_NAME_LENGTH } from '@/constants/bootstrap';

/**
 * Type guard for function type checking.
 * @param {unknown} value - Value to check.
 * @returns {boolean} True if value is a function.
 */
const isFunction = (value: unknown): value is ((...args: unknown[]) => unknown) => {
  return typeof value === 'function';
};

/**
 * Type guard for module constructor.
 * @param {unknown} value - Value to check.
 * @returns {boolean} True if value is a module constructor.
 */
const isModuleConstructor = (value: unknown): value is ModuleConstructor => {
  return typeof value === 'function';
};

/**
 * Find module class in exports.
 * @param {Record<string, unknown>} moduleExports - Module exports.
 * @param {string} path - Module path.
 * @returns {ModuleConstructor} Module constructor.
 * @throws {Error} If no module class found.
 */
export const findModuleClass = (
  moduleExports: Record<string, unknown>,
  path: string,
): ModuleConstructor => {
  const { default: defaultExport } = moduleExports;
  if (defaultExport !== undefined && isModuleConstructor(defaultExport)) {
    return defaultExport;
  }

  const moduleKey = Object.keys(moduleExports).find(
    (key): boolean => {
      return key.endsWith('Module')
        && isModuleConstructor(moduleExports[key]);
    },
  );

  if (moduleKey === undefined) {
    throw new Error(`No module class found in ${path}`);
  }

  const { [moduleKey]: moduleConstructor } = moduleExports;
  if (isModuleConstructor(moduleConstructor)) {
    return moduleConstructor;
  }

  throw new Error(`Invalid module constructor in ${path}`);
};

/**
 * Check if an export is a valid module.
 * @param {unknown} instance - Module instance to check.
 * @returns {boolean} True if valid module.
 */
export const isValidModule = (instance: unknown): instance is IModule => {
  if (
    typeof instance !== 'object'
    || instance === null
    || !('name' in instance)
    || !('version' in instance)
    || !('type' in instance)
  ) {
    return false;
  }

  if (!('name' in instance)) {
    return false;
  }

  const instanceRecord = instance;

  return (
    typeof instanceRecord.name === 'string'
    && instanceRecord.name.length >= MIN_MODULE_NAME_LENGTH
  );
};

/**
 * Create module instance from exports.
 * @param {Record<string, unknown>} moduleExports - Module exports.
 * @param {string} name - Module name.
 * @param {string} type - Module type.
 * @returns {IModule} Module instance.
 * @throws {Error} If module type unknown or creation fails.
 */
export const createModuleInstance = (
  moduleExports: Record<string, unknown>,
  name: string,
  type: string,
): IModule => {
  if (type === 'self-contained' || type === 'service') {
    const { createModule } = moduleExports;
    if (isFunction(createModule)) {
      const moduleInstance = createModule();
      if (moduleInstance !== null
        && moduleInstance !== undefined
        && typeof moduleInstance === 'object'
        && isValidModule(moduleInstance)) {
        return moduleInstance;
      }
    }

    const { default: defaultExport } = moduleExports;
    if (defaultExport !== undefined && isModuleConstructor(defaultExport)) {
      const Ctor = defaultExport;
      return new Ctor();
    }

    throw new Error(
      `Module ${name} must export createModule function or default constructor`
    );
  }
  throw new Error(`Unknown module type: ${type}`);
};

/**
 * Load a core module.
 * @param {ICoreModuleDefinition} definition - Module definition.
 * @param {Map<string, IModule>} modules - Loaded modules map.
 * @returns {Promise<IModule>} Module instance.
 */
export const loadCoreModule = async (
  definition: ICoreModuleDefinition,
  modules: Map<string, IModule>,
): Promise<IModule> => {
  const {
    name, path, dependencies, type
  } = definition;

  for (const dep of dependencies) {
    if (!modules.has(dep)) {
      throw new Error(`Dependency '${dep}' not loaded for module '${name}'`);
    }
  }

  const { href: resolvedPath } = new URL(path, `file://${process.cwd()}/`);
  // Dynamic import needed for lazy loading core modules at runtime
  // eslint-disable-next-line no-restricted-syntax
  const moduleExports = await import(resolvedPath) as Record<string, unknown>;
  const moduleInstance = createModuleInstance(moduleExports, name, type);

  if (!isValidModule(moduleInstance)) {
    throw new Error(`Invalid module instance for ${name}`);
  }

  return moduleInstance;
};

/**
 * Load an extension module.
 * Config parameter is reserved for future use.
 * @param {object} moduleInfo - Module information.
 * @param {string} moduleInfo.name - Module name.
 * @param {string} moduleInfo.path - Module path.
 * @param {string} moduleInfo.type - Module type.
 * @param {unknown} config - Global configuration (unused).
 * @returns {Promise<IModule>} Module instance.
 */
export const loadExtensionModule = async (
  moduleInfo: { name: string; path: string; type: string },
  config: unknown,
): Promise<IModule> => {
  config;
  const {
    name, path, type
  } = moduleInfo;
  const { href: resolvedPath } = new URL(path, `file://${process.cwd()}/`);
  // Dynamic import needed for lazy loading extension modules at runtime
  // eslint-disable-next-line no-restricted-syntax
  const moduleExports = await import(resolvedPath) as Record<string, unknown>;
  const moduleInstance = createModuleInstance(moduleExports, name, type);

  if (!isValidModule(moduleInstance)) {
    throw new Error(`Invalid module instance for ${name}`);
  }

  return moduleInstance;
};
