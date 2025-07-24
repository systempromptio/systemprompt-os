/**
 * Bootstrap module types.
 * @file Bootstrap module types.
 * @module types/bootstrap-module
 */

import type { IModule, ModuleInfo } from '@/modules/core/modules/types/index.js';

/**
 * Type alias for module constructor.
 */
export type ModuleConstructor = new () => IModule;

/**
 * Module exports interface.
 */
export interface IModuleExports {
  scanForModules: () => Promise<ModuleInfo[]>;
  getEnabledModules: () => Promise<ModuleInfo[]>;
}
