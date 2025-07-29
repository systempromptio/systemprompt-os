/**
 * Module loader service types.
 */

import type { IModule } from '@/modules/core/modules/types/index';

/**
 * Module context for initialization.
 */
export interface IModuleContext {
  config: Record<string, unknown>;
  logger: any; // Avoid circular dependency
  [key: string]: unknown;
}

/**
 * Module configuration for loading.
 */
export interface IModuleConfiguration {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, unknown>;
  dependencies?: string[];
}

/**
 * Module exports from dynamic imports.
 */
export interface ModuleExports {
  createModule?: () => IModule;
  default?: IModule | (() => IModule);
  [key: string]: any;
}
