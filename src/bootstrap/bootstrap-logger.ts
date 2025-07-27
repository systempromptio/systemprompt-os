/**
 * Bootstrap logger utilities for consistent logging.
 * @module bootstrap/bootstrap-logger
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

import type { LogCategory } from '@/types/bootstrap';

/**
 * Capitalize first letter of string.
 * @param {string} str - The string to capitalize.
 * @returns {string} The capitalized string.
 */
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Bootstrap logger wrapper for consistent logging patterns.
 */
export class BootstrapLogger {
  /**
   * Creates a new BootstrapLogger instance.
   * @param {ILogger} logger - The logger instance to use.
   */
  constructor(private readonly logger: ILogger) {}

  /**
   * Log debug message with bootstrap context.
   * @param {string} message - The message to log.
   * @param {LogCategory} category - The log category.
   * @param {boolean} persistToDb - Whether to persist the log to database.
   */
  debug(message: string, category: LogCategory, persistToDb = false): void {
    this.logger.debug(LogSource.BOOTSTRAP, message, {
      category,
      persistToDb
    });
  }

  /**
   * Log info message with bootstrap context.
   * @param {string} message - The message to log.
   * @param {LogCategory} category - The log category.
   */
  info(message: string, category: LogCategory): void {
    this.logger.info(LogSource.BOOTSTRAP, message, { category });
  }

  /**
   * Log warning message with bootstrap context.
   * @param {string} message - The message to log.
   * @param {LogCategory} category - The log category.
   */
  warn(message: string, category: LogCategory): void {
    this.logger.warn(LogSource.BOOTSTRAP, message, { category });
  }

  /**
   * Log error message with bootstrap context.
   * @param {string} message - The message to log.
   * @param {LogCategory} category - The log category.
   * @param {unknown} error - The error object or message.
   */
  error(message: string, category: LogCategory, error?: unknown): void {
    this.logger.error(LogSource.BOOTSTRAP, message, {
      category,
      error: error instanceof Error ? error : new Error(String(error))
    });
  }

  /**
   * Log module operation (load, initialize, start).
   * @param {'load' | 'initialize' | 'start' | 'stop'} operation - The operation type.
   * @param {string} moduleName - The name of the module.
   * @param {boolean} success - Whether the operation was successful.
   */
  moduleOperation(
    operation: 'load' | 'initialize' | 'start' | 'stop',
    moduleName: string,
    success = true
  ): void {
    const message = success
      ? `${capitalize(operation)}d module: ${moduleName}`
      : `Failed to ${operation} module: ${moduleName}`;

    if (success) {
      this.debug(message, 'modules');
    } else {
      this.error(message, 'modules');
    }
  }

  /**
   * Log phase transition.
   * @param {string} phaseName - The name of the phase.
   * @param {boolean} starting - Whether the phase is starting or ending.
   */
  phaseTransition(phaseName: string, starting = true): void {
    const message = starting
      ? `Starting ${phaseName} phase`
      : `Completed ${phaseName} phase`;
    this.debug(message, 'startup');
  }
}
