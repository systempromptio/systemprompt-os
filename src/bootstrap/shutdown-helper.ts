/**
 * Shutdown helper functions for bootstrap.
 * @file Shutdown helper functions for bootstrap.
 * @module bootstrap/shutdown-helper
 */

import type { IModule } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Check if module has a specific method.
 * @param {IModule} moduleInstance - Module instance.
 * @param {string} method - Method name.
 * @returns {boolean} True if module has method.
 */
export const moduleHasMethod = (moduleInstance: IModule, method: string): boolean => {
  const key = method as keyof IModule;
  return key in moduleInstance && moduleInstance[key] !== undefined;
};

/**
 * Shutdown a single module safely.
 * @param {string} name - Module name.
 * @param {IModule} moduleInstance - Module instance.
 * @param {ILogger} logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when module is shut down.
 */
export const shutdownModule = async (
  name: string,
  moduleInstance: IModule,
  logger: ILogger,
): Promise<void> => {
  if (!moduleHasMethod(moduleInstance, 'stop')) {
    return;
  }

  try {
    logger.debug(LogSource.BOOTSTRAP, `Stopping module: ${name}`);
    const stopMethod = moduleInstance.stop;
    if (stopMethod !== undefined) {
      await stopMethod.call(moduleInstance);
    }
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Error stopping module ${name}:`, {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};

/**
 * Shutdown all modules in reverse order.
 * @param {Map<string, IModule>} modules - Map of loaded modules.
 * @param {ILogger} logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when all modules are shut down.
 */
export const shutdownAllModules = async (
  modules: Map<string, IModule>,
  logger: ILogger,
): Promise<void> => {
  const moduleNames = Array.from(modules.keys()).reverse();

  for (const name of moduleNames) {
    const moduleInstance = modules.get(name);
    if (moduleInstance !== undefined) {
      await shutdownModule(name, moduleInstance, logger);
    }
  }
};
