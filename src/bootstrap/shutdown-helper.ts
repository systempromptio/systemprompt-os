/**
 * Shutdown helper functions for bootstrap.
 * @file Shutdown helper functions for bootstrap.
 * @module bootstrap/shutdown-helper
 */

import type { IModule } from '@/modules/core/modules/types/manual';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';

/**
 * Check if module has a specific method.
 * @param {IModule} moduleInstance - Module instance.
 * @param {string} method - Method name.
 * @returns {boolean} True if module has method.
 */
export const moduleHasMethod = (moduleInstance: IModule, method: string): boolean => {
  if (method === 'stop') {
    return 'stop' in moduleInstance && typeof moduleInstance.stop === 'function';
  }
  return Object.hasOwn(moduleInstance, method);
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
    const stopPromise = (moduleInstance as any).stop();
    const timeoutPromise = new Promise<void>((_, reject) =>
      { return setTimeout(() => { reject(new Error(`Module ${name} stop timeout`)); }, 3000) });
    await Promise.race([stopPromise, timeoutPromise]);
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Error stopping module ${name}:`, {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};

/**
 * Recursively shutdown modules in sequence.
 * @param {object} options - Shutdown options.
 * @param {string[]} options.moduleNames - Array of module names to shutdown.
 * @param {Map<string, IModule>} options.modules - Map of loaded modules.
 * @param {ILogger} options.logger - Logger instance.
 * @param {number} options.index - Current index in the module names array.
 * @returns {Promise<void>} Promise that resolves when all modules are shut down.
 */
const shutdownModulesSequentially = async ({
  moduleNames,
  modules,
  logger,
  index = 0
}: {
  moduleNames: string[];
  modules: Map<string, IModule>;
  logger: ILogger;
  index?: number;
}): Promise<void> => {
  if (index >= moduleNames.length) {
    return;
  }

  const [name] = moduleNames.slice(index, index + 1);
  if (name !== undefined) {
    const moduleInstance = modules.get(name);
    if (moduleInstance !== undefined) {
      await shutdownModule(name, moduleInstance, logger);
    }
  }

  await shutdownModulesSequentially({
    moduleNames,
    modules,
    logger,
    index: index + 1
  });
};

/**
 * Shutdown all modules in reverse order.
 * Sequential shutdown is required to ensure proper cleanup order.
 * @param {Map<string, IModule>} modules - Map of loaded modules.
 * @param {ILogger} logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when all modules are shut down.
 */
export const shutdownAllModules = async (
  modules: Map<string, IModule>,
  logger: ILogger,
): Promise<void> => {
  const moduleNames = Array.from(modules.keys()).reverse();

  const shutdownPromise = shutdownModulesSequentially({
    moduleNames,
    modules,
    logger
  });

  const globalTimeoutPromise = new Promise<void>((_, reject) =>
    { return setTimeout(() => { reject(new Error('Global shutdown timeout')); }, 10000) });

  try {
    await Promise.race([shutdownPromise, globalTimeoutPromise]);
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Shutdown timeout exceeded', {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};
