/**
 * Console logger utility functions.
 * @file Console logger utility functions.
 * @module utils/console-logger
 */

import type { ILogger } from '@/modules/core/logger/types/index';

/**
 * Console logger info method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleInfo = (message: string, ...args: unknown[]): void => {
  console.log(`[BOOT] ${message}`, ...args);
};

/**
 * Console logger error method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleError = (message: string, ...args: unknown[]): void => {
  console.error(`[BOOT ERROR] ${message}`, ...args);
};

/**
 * Console logger warn method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleWarn = (message: string, ...args: unknown[]): void => {
  console.warn(`[BOOT WARN] ${message}`, ...args);
};

/**
 * Console logger debug method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleDebug = (message: string, ...args: unknown[]): void => {
  console.log(`[BOOT DEBUG] ${message}`, ...args);
};

/**
 * Creates a console logger for early bootstrap stages.
 * @returns {ILogger} Console logger implementation.
 */
export const createConsoleLogger = (): ILogger => {
  return {
    info: consoleInfo,
    error: consoleError,
    warn: consoleWarn,
    debug: consoleDebug,
  } as ILogger;
};
