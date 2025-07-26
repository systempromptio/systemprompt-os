/**
 * Bootstrap module types.
 * @file Bootstrap module types.
 * @module types/bootstrap-module
 */

import type { IModule, IModuleInfo } from '@/modules/core/modules/types/index';

/**
 * Type alias for module constructor.
 */
export type ModuleConstructor = new () => IModule;

/**
 * Module exports interface.
 */
export interface IModuleExports {
  scanForModules: () => Promise<IModuleInfo[]>;
  getEnabledModules: () => Promise<IModuleInfo[]>;
}
