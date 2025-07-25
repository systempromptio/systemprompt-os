/**
 * @fileoverview Core logger module - provides system-wide logging
 * @module modules/core/logger
 */

import { Service, Inject, Container } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { LoggerService } from './services/logger.service.js';
import { LoggerInitializationError } from './utils/errors.js';
import type { LogFiles, Logger, LoggerConfig, LogLevelName, LogOutput } from './types/index.js';

/**
 * Logger module implementation
 * @class LoggerModule
 * @implements {IModule}
 */
@Service()
export class LoggerModule implements IModule {
  public readonly name = 'logger';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'System-wide logging service with file and console output';
  public status = ModuleStatus.STOPPED;

  private readonly loggerService: LoggerService;
  private initialized = false;
  private started = false;

  constructor(@Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration) {
    this.loggerService = LoggerService.getInstance();
  }

  /**
   * Initialize the logger module
   * @throws {LoggerInitializationError} If initialization fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new LoggerInitializationError('Logger module already initialized');
    }

    try {
      const configData = this.globalConfig?.modules?.['logger'] || {};
      const config: LoggerConfig = {
        stateDir: (configData['stateDir'] as string) || './state',
        logLevel: (configData['logLevel'] as LogLevelName) || 'info',
        maxSize: (configData['maxSize'] as string) || '10m',
        maxFiles: (configData['maxFiles'] as number) || 5,
        outputs: (configData['outputs'] as LogOutput[]) || ['console'],
        files: (configData['files'] as LogFiles) || {
          system: 'system.log',
          error: 'error.log',
          access: 'access.log',
        },
      };

      if (!config) {
        throw new LoggerInitializationError('Logger configuration is required');
      }

      await this.loggerService.initialize(config);
      this.initialized = true;

      // Log initialization success
      this.loggerService.info('Logger module initialized successfully', {
        version: this.version,
        logLevel: config.logLevel,
        outputs: config.outputs,
      });
    } catch (error) {
      if (error instanceof LoggerInitializationError) {
        throw error;
      }
      throw new LoggerInitializationError('Failed to initialize logger module', error as Error);
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
          message: 'Logger module not initialized',
        };
      }

      if (!this.started) {
        return {
          healthy: false,
          message: 'Logger module not started',
        };
      }

      // Test write capability by attempting to log
      this.loggerService.debug('Health check test log');

      return {
        healthy: true,
        message: 'Logger module is healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Logger health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      types: import('./types'),
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
export function createModule(_config: LoggerConfig): LoggerModule {
  return Container.get(LoggerModule);
}

// Export default instance
export default LoggerModule;

// Re-export types for convenience
export type { Logger, LoggerConfig, LogLevelName, LogLevel } from './types/index.js';
export { LoggerService } from './services/logger.service.js';
export * from './utils/errors.js';
