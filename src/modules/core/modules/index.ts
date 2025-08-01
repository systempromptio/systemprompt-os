/**
 * Modules Module - Core module system management.
 * This module manages all other modules in the system.
 * Factory methods and module access only - import types from ./types.
 */

import { ModulesModuleService } from '@/modules/core/modules/services/modules.service';
import { ModuleRegistryService } from '@/modules/core/modules/services/module-registry.service';
import { ModuleSetupService } from '@/modules/core/modules/services/module-setup.service';
import { ModuleName } from '@/modules/types/module-names.types';
import type { IModule, IModulesModuleExports } from "@/modules/core/modules/types/manual";
import type { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Type guard to check if a module is the Modules module.
 * @param mod - Module to check.
 * @returns True if module is the Modules module.
 */
export const isModulesModule = (
  mod: unknown
): mod is IModule<IModulesModuleExports> => {
  const candidate = mod as IModule<IModulesModuleExports>;
  return candidate?.name === 'modules'
    && Boolean(candidate.exports)
    && typeof candidate.exports === 'object'
    && 'service' in candidate.exports
    && typeof candidate.exports.service === 'function'
    && 'loadCoreModule' in candidate.exports
    && typeof candidate.exports.loadCoreModule === 'function';
};

/**
 * Creates the modules module instance.
 * Required by the bootstrap process.
 */
export const createModule = (): ModulesModuleService => {
  return ModulesModuleService.getInstance();
};

/**
 * Initialize function for core module pattern.
 * @returns Initialized modules module.
 */
export const initialize = async (): Promise<ModulesModuleService> => {
  const modulesModule = ModulesModuleService.getInstance();
  await modulesModule.initialize();
  return modulesModule;
};

/**
 * Gets the Modules module with type safety and validation.
 * Ensures the module is loaded and has required exports.
 * @returns The Modules module with guaranteed typed exports.
 * @throws Error if Modules module is not available or missing required exports.
 */
export function getModulesModule(): IModule<IModulesModuleExports> {
  const { getModuleRegistry } = require('@/modules/loader');
  const registry = getModuleRegistry();
  const modulesModule = registry.get(ModuleName.MODULES);

  if (!modulesModule) {
    throw new Error('Modules module not found in registry');
  }

  if (!isModulesModule(modulesModule)) {
    throw new Error('Modules module is missing required exports');
  }

  return modulesModule;
}

/**
 * Gets the module registry service directly.
 * For bootstrap and testing use.
 * @returns The module registry service.
 */
export function getModuleRegistry(): ModuleRegistryService {
  return ModuleRegistryService.getInstance();
}

/**
 * Gets the module setup service for database operations.
 * @param database - Database service instance.
 * @returns Module setup service instance.
 */
export function getModuleSetupService(database: DatabaseService): ModuleSetupService {
  return ModuleSetupService.getInstance(database);
}
