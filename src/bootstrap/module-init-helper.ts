/**
 * Module initialization helper functions for bootstrap.
 * @file Module initialization helper functions for bootstrap.
 * @module bootstrap/module-init-helper
 */

import type { IModule } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { moduleHasMethod } from '@/bootstrap/shutdown-helper.js';

/**
 * Initialize a single module safely.
 * @param {string} _name - Module name.
 * @param {IModule} moduleInstance - Module instance.
 * @param {ILogger} _logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when module is initialized.
 * @throws {Error} If initialization fails.
 */
export const initializeSingleModule = async (
  _name: string,
  moduleInstance: IModule,
  _logger: ILogger,
): Promise<void> => {
  if (moduleHasMethod(moduleInstance, 'initialize')) {
    const { initialize: initMethod } = moduleInstance;
    if (initMethod !== undefined) {
      await initMethod.call(moduleInstance);
    }
  }
};

/**
 * Start a single module safely.
 * @param {string} name - Module name.
 * @param {IModule} moduleInstance - Module instance.
 * @param {ILogger} logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when module is started.
 * @throws {Error} If start fails.
 */
export const startSingleModule = async (
  name: string,
  moduleInstance: IModule,
  logger: ILogger,
): Promise<void> => {
  if (!moduleHasMethod(moduleInstance, 'start')) {
    return;
  }

  logger.debug(`Starting module: ${name}`);
  const { start: startMethod } = moduleInstance;
  if (startMethod !== undefined) {
    await startMethod.call(moduleInstance);
  }
  logger.debug(`Started module: ${name}`);
};

/**
 * Check if logger module needs upgrade from console to full logger.
 * @param {string} name - Module name.
 * @param {IModule} moduleInstance - Module instance.
 * @returns {ILogger | undefined} Logger service if upgrade needed.
 */
export const checkLoggerUpgrade = (
  name: string,
  moduleInstance: IModule,
): ILogger | undefined => {
  if (name !== 'logger') {
    return undefined;
  }

  const hasExports = moduleInstance.exports !== undefined;
  if (!hasExports) {
    return undefined;
  }

  const { exports: moduleExports } = moduleInstance;
  const hasService = moduleExports !== undefined && 'service' in moduleExports;
  if (!hasService) {
    return undefined;
  }

  const service = moduleExports['service'];
  return service as ILogger;
};
