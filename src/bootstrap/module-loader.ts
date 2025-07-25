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
import { MIN_MODULE_NAME_LENGTH } from '@/const/bootstrap';

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
  if (moduleExports.default !== undefined
    && typeof moduleExports.default === 'function') {
    return moduleExports.default as ModuleConstructor;
  }

  const moduleKey = Object.keys(moduleExports).find(
    (key): boolean => { return key.endsWith('Module')
      && typeof moduleExports[key] === 'function' },
  );

  if (moduleKey === undefined) {
    throw new Error(`No module class found in ${path}`);
  }

  return moduleExports[moduleKey] as ModuleConstructor;
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
  if (type === 'self-contained') {
    if (typeof moduleExports.createModule === 'function') {
      const createFn = moduleExports.createModule as () => IModule;
      return createFn();
    }
    if (moduleExports.default !== undefined
      && typeof moduleExports.default === 'function') {
      const ModuleConstructorFn = moduleExports.default as ModuleConstructor;
      return new ModuleConstructorFn();
    }
    throw new Error(`Self-contained module ${name} must export createModule function`);
  }
  throw new Error(`Unknown module type: ${type}`);
};

/**
 * Check if an export is a valid module.
 * @param {unknown} instance - Module instance to check.
 * @returns {boolean} True if valid module.
 */
export const isValidModule = (instance: unknown): instance is IModule => {
  const mod = instance as IModule;
  return (
    typeof instance === 'object'
    && instance !== null
    && 'name' in instance
    && 'version' in instance
    && 'type' in instance
    && typeof mod.name === 'string'
    && mod.name.length >= MIN_MODULE_NAME_LENGTH
  );
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

  const resolvedPath = new URL(path, `file://${process.cwd()}/`).href;
  const moduleExports = await import(resolvedPath) as Record<string, unknown>;
  const moduleInstance = createModuleInstance(moduleExports, name, type);

  if (!isValidModule(moduleInstance)) {
    throw new Error(`Invalid module instance for ${name}`);
  }

  return moduleInstance;
};

/**
 * Load an extension module.
 * @param moduleInfo - Module information.
 * @param moduleInfo.name
 * @param _config - Global configuration.
 * @param moduleInfo.path
 * @param moduleInfo.type
 * @returns Module instance.
 */
export const loadExtensionModule = async (
  moduleInfo: { name: string; path: string; type: string },
  _config: unknown,
): Promise<IModule> => {
  const {
 name, path, type
} = moduleInfo;
  const resolvedPath = new URL(path, `file://${process.cwd()}/`).href;
  const moduleExports = await import(resolvedPath) as Record<string, unknown>;
  const moduleInstance = createModuleInstance(moduleExports, name, type);

  if (!isValidModule(moduleInstance)) {
    throw new Error(`Invalid module instance for ${name}`);
  }

  return moduleInstance;
};
