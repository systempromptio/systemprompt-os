/**
 * Module initialization helper functions for bootstrap.
 * @file Module initialization helper functions for bootstrap.
 * @module bootstrap/module-init-helper
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { moduleHasMethod } from '@/bootstrap/shutdown-helper';

/**
 * Initialize a single module safely.
 * @param {string} name - Module name.
 * @param {IModule} moduleInstance - Module instance.
 * @param {ILogger} logger - Logger instance.
 * @returns {Promise<void>} Promise that resolves when module is initialized.
 * @throws {Error} If initialization fails.
 */
export const initializeSingleModule = async (
  name: string,
  moduleInstance: IModule,
  logger: ILogger,
): Promise<void> => {
  if (moduleHasMethod(moduleInstance, 'initialize')) {
    logger.debug(LogSource.BOOTSTRAP, `Initializing module: ${name}`, { persistToDb: false });
    const boundInitialize = moduleInstance.initialize.bind(moduleInstance);
    await boundInitialize();
    logger.debug(LogSource.BOOTSTRAP, `Initialized module: ${name}`, { persistToDb: false });
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

  logger.debug(LogSource.BOOTSTRAP, `Starting module: ${name}`, { persistToDb: false });
  if (moduleHasMethod(moduleInstance, 'start')) {
    const boundStart = moduleInstance.start.bind(moduleInstance);
    await boundStart();
  }
  logger.debug(LogSource.BOOTSTRAP, `Started module: ${name}`, { persistToDb: false });
};

/**
 * Check if module exports have a logger service.
 * @param {unknown} moduleExports - Module exports to check.
 * @returns {boolean} True if exports contain a logger service.
 */
const hasLoggerService = (moduleExports: unknown): moduleExports is { service: unknown } => {
  return (
    moduleExports !== null
    && typeof moduleExports === 'object'
    && 'service' in moduleExports
  );
};

/**
 * Type guard to check if object is a valid logger instance.
 * @param {unknown} obj - Object to check.
 * @returns {boolean} True if object is a logger.
 */
const isLoggerInstance = (obj: unknown): obj is ILogger => {
  return (
    obj !== null
    && typeof obj === 'object'
    && 'info' in obj
    && typeof obj.info === 'function'
    && 'warn' in obj
    && typeof obj.warn === 'function'
    && 'error' in obj
    && typeof obj.error === 'function'
    && 'debug' in obj
    && typeof obj.debug === 'function'
  );
};

/**
 * Extract logger from service accessor.
 * @param {unknown} serviceAccessor - Service accessor to check.
 * @returns {ILogger | undefined} Logger instance if valid.
 */
const extractLoggerFromService = (serviceAccessor: unknown): ILogger | undefined => {
  if (typeof serviceAccessor === 'function') {
    try {
      const loggerInstance = serviceAccessor();
      if (isLoggerInstance(loggerInstance)) {
        return loggerInstance;
      }
    } catch {
      return undefined;
    }
  }

  if (isLoggerInstance(serviceAccessor)) {
    return serviceAccessor;
  }

  return undefined;
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

  const { exports: moduleExports } = moduleInstance;
  if (moduleExports === undefined || !hasLoggerService(moduleExports)) {
    return undefined;
  }

  const { service: serviceAccessor } = moduleExports;
  return extractLoggerFromService(serviceAccessor);
};
