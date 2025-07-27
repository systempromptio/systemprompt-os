/**
 * Bootstrap logger utilities for consistent logging.
 * @module bootstrap/bootstrap-logger
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

export type LogCategory = 'startup' | 'shutdown' | 'modules' | 'database' | 'discovery' | 'mcp' | 'cli' | 'error' | 'logger' | 'debug';

/**
 * Bootstrap logger wrapper for consistent logging patterns.
 */
export class BootstrapLogger {
  constructor(private readonly logger: ILogger) {}

  /**
   * Log debug message with bootstrap context.
   * @param message
   * @param category
   * @param persistToDb
   */
  debug(message: string, category: LogCategory, persistToDb = false): void {
    this.logger.debug(LogSource.BOOTSTRAP, message, {
      category,
      persistToDb
    });
  }

  /**
   * Log info message with bootstrap context.
   * @param message
   * @param category
   */
  info(message: string, category: LogCategory): void {
    this.logger.info(LogSource.BOOTSTRAP, message, { category });
  }

  /**
   * Log warning message with bootstrap context.
   * @param message
   * @param category
   */
  warn(message: string, category: LogCategory): void {
    this.logger.warn(LogSource.BOOTSTRAP, message, { category });
  }

  /**
   * Log error message with bootstrap context.
   * @param message
   * @param category
   * @param error
   */
  error(message: string, category: LogCategory, error?: unknown): void {
    this.logger.error(LogSource.BOOTSTRAP, message, {
      category,
      error: error instanceof Error ? error : new Error(String(error))
    });
  }

  /**
   * Log module operation (load, initialize, start).
   * @param operation
   * @param moduleName
   * @param success
   */
  moduleOperation(operation: 'load' | 'initialize' | 'start' | 'stop', moduleName: string, success = true): void {
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
   * @param phaseName
   * @param starting
   */
  phaseTransition(phaseName: string, starting = true): void {
    const message = starting
      ? `Starting ${phaseName} phase`
      : `Completed ${phaseName} phase`;
    this.debug(message, 'startup');
  }
}

/**
 * Capitalize first letter of string.
 * @param str
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
