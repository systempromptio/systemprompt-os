/**
 * Console logger utility functions.
 * @file Console logger utility functions.
 * @module utils/console-logger
 */

import type { ILogger } from '@/modules/core/logger/types/index';

/**
 * Check if running in CLI mode.
 * @returns {boolean} True if in CLI mode.
 */
const isCliMode = (): boolean => {
  return process.env.LOG_MODE === 'cli' || process.argv[1]?.includes('cli') === true;
};

/**
 * Console logger info method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleInfo = (message: string, ...args: unknown[]): void => {
  if (!isCliMode()) {
    console.log(`[BOOT] ${message}`, ...args);
  }
};

/**
 * Console logger error method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleError = (message: string, ...args: unknown[]): void => {
  if (!isCliMode()) {
    console.error(`[BOOT ERROR] ${message}`, ...args);
  }
};

/**
 * Console logger warn method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleWarn = (message: string, ...args: unknown[]): void => {
  if (!isCliMode()) {
    console.warn(`[BOOT WARN] ${message}`, ...args);
  }
};

/**
 * Console logger debug method.
 * @param {string} message - Message to log.
 * @param {unknown[]} args - Additional arguments.
 * @returns {void} Nothing.
 */
export const consoleDebug = (message: string, ...args: unknown[]): void => {
  if (!isCliMode()) {
    console.log(`[BOOT DEBUG] ${message}`, ...args);
  }
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
