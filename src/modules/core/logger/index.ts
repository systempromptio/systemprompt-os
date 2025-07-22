/**
 * @fileoverview Core logger module - provides system-wide logging
 * @module modules/core/logger
 */

import { ModuleInterface, ModuleContext } from '@/modules/types';
import { Logger, LoggerConfig } from '@/modules/core/logger/types';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerInitializationError } from '@/modules/core/logger/utils/errors';

/**
 * Logger module implementation
 * @class LoggerModule
 * @implements {ModuleInterface}
 */
export class LoggerModule implements ModuleInterface {
  public readonly name = 'logger';
  public readonly type: 'core' = 'core';
  public readonly version = '1.0.0';
  public readonly description = 'System-wide logging service with file and console output';

  private loggerService: LoggerService;
  private initialized = false;
  private started = false;

  constructor() {
    this.loggerService = LoggerService.getInstance();
  }

  /**
   * Initialize the logger module
   * @param {ModuleContext} context - Module context with configuration
   * @throws {LoggerInitializationError} If initialization fails
   */
  async initialize(context: ModuleContext): Promise<void> {
    if (this.initialized) {
      throw new LoggerInitializationError('Logger module already initialized');
    }

    try {
      const config = context.config as LoggerConfig;
      
      if (!config) {
        throw new LoggerInitializationError('Logger configuration is required');
      }

      await this.loggerService.initialize(config);
      this.initialized = true;

      // Log initialization success
      this.loggerService.info(`Logger module initialized successfully`, {
        version: this.version,
        logLevel: config.logLevel,
        outputs: config.outputs
      });
    } catch (error) {
      if (error instanceof LoggerInitializationError) {
        throw error;
      }
      throw new LoggerInitializationError(
        'Failed to initialize logger module',
        error as Error
      );
    }
  }

  /**
   * Start the logger module
   * @throws {Error} If module not initialized
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Logger module not initialized');
    }

    if (this.started) {
      throw new Error('Logger module already started');
    }

    this.started = true;
    this.loggerService.info('Logger module started');
  }

  /**
   * Stop the logger module
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.loggerService.info('Logger module stopping');
      this.started = false;
    }
  }

  /**
   * Perform health check on the logger module
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.initialized) {
        return {
          healthy: false,
          message: 'Logger module not initialized'
        };
      }

      if (!this.started) {
        return {
          healthy: false,
          message: 'Logger module not started'
        };
      }

      // Test write capability by attempting to log
      this.loggerService.debug('Health check test log');

      return { 
        healthy: true,
        message: 'Logger module is healthy'
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Logger health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get module exports
   * @returns {any} Module exports
   */
  get exports(): any {
    return {
      service: this.getService(),
      LoggerService,
      types: require('./types')
    };
  }

  /**
   * Get the logger service
   * @returns {Logger} Logger service instance
   */
  getService(): Logger {
    if (!this.initialized) {
      throw new Error('Logger module not initialized');
    }
    return this.loggerService;
  }
}

/**
 * Factory function for module system
 * @param {LoggerConfig} config - Logger configuration
 * @returns {LoggerModule} Logger module instance
 */
export function createModule(config: LoggerConfig): LoggerModule {
  return new LoggerModule();
}

// Export default instance
export default new LoggerModule();

// Re-export types for convenience
export type { Logger, LoggerConfig, LogLevelName, LogLevel } from './types';
export { LoggerService } from './services/logger.service';
export * from './utils/errors';