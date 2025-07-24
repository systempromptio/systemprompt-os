/**
 * Core logger module - provides system-wide logging.
 * @file Core logger module - provides system-wide logging.
 * @module modules/core/logger
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { LoggerInitializationError } from '@/modules/core/logger/utils/errors/index.js';
import type {
  ILogFiles,
  ILogger,
  ILoggerConfig,
  LogLevelName,
  LogOutput,
} from '@/modules/core/logger/types/index.js';

/**
 * Logger module implementation - self-contained.
 * @class LoggerModule
 */
export class LoggerModule {
  public readonly name = 'logger';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'System-wide logging service with file and console output';
  public readonly dependencies = [];
  public status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private readonly loggerService: LoggerService;
  private initialized = false;
  private started = false;

  /**
   * Constructor.
   */
  constructor() {
    this.loggerService = LoggerService.getInstance();
  }

  /**
   * Initialize the logger module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   * @throws {LoggerInitializationError} If initialization fails.
   */
  async initialize(): Promise<void> {
    await Promise.resolve();
    if (this.initialized) {
      throw new LoggerInitializationError('Logger module already initialized');
    }

    try {
      const config = this.buildConfig();
      this.loggerService.initialize(config);
      this.initialized = true;
      this.loggerService.info('Logger module initialized successfully', {
        version: this.version,
        logLevel: config.logLevel,
        outputs: config.outputs,
      });
    } catch (error) {
      if (error instanceof LoggerInitializationError) {
        throw error;
      }
      throw new LoggerInitializationError(
        'Failed to initialize logger module',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Start the logger module.
   * @returns {Promise<void>} Promise that resolves when started.
   * @throws {Error} If module not initialized.
   */
  async start(): Promise<void> {
    await new Promise<void>((resolve): void => {
      if (!this.initialized) {
        throw new Error('Logger module not initialized');
      }

      if (this.started) {
        throw new Error('Logger module already started');
      }

      this.started = true;
      this.loggerService.info('Logger module started');
      resolve();
    });
  }

  /**
   * Stop the logger module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    await new Promise<void>((resolve): void => {
      if (this.started) {
        this.loggerService.info('Logger module stopping');
        this.started = false;
      }
      resolve();
    });
  }

  /**
   * Perform health check on the logger module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{
    healthy: boolean;

    message?: string;
  }> {
    await Promise.resolve();
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
    this.loggerService.debug('Health check test log');
    return {
      healthy: true,
      message: 'Logger module is healthy',
    };
  }

  /**
   * Get the logger service.
   * @returns {ILogger} Logger service instance.
   * @throws {Error} If module not initialized.
   */
  getService(): ILogger {
    if (!this.initialized) {
      throw new Error('Logger module not initialized');
    }
    return this.loggerService;
  }

  /**
   * Check if a log level is valid.
   * @param {string} level - Log level to check.
   * @returns {boolean} True if valid.
   */
  private isValidLogLevel(level: string): level is LogLevelName {
    return level === 'debug' || level === 'info' || level === 'warn' || level === 'error';
  }

  /**
   * Get state directory config.
   * @returns {string} State directory.
   */
  private getStateDir(): string {
    const DEFAULT_STATE_DIR = './state';
    return process.env['LOG_STATE_DIR'] ?? DEFAULT_STATE_DIR;
  }

  /**
   * Get log level config.
   * @returns {LogLevelName} Log level.
   */
  private getLogLevel(): LogLevelName {
    const DEFAULT_LOG_LEVEL: LogLevelName = 'info';
    const level = process.env['LOG_LEVEL'] ?? '';
    if (level !== '' && this.isValidLogLevel(level)) {
      return level;
    }
    return DEFAULT_LOG_LEVEL;
  }

  /**
   * Get outputs config.
   * @returns {LogOutput[]} Outputs.
   */
  private getOutputs(): LogOutput[] {
    const outputs = process.env['LOG_OUTPUTS'] ?? '';
    if (outputs !== '') {
      return outputs.split(',').filter((output): output is LogOutput => {
        return output === 'console' || output === 'file';
      });
    }
    return ['console'];
  }

  /**
   * Get files config.
   * @returns {ILogFiles} Files configuration.
   */
  private getFiles(): ILogFiles {
    return {
      system: process.env['LOG_FILE_SYSTEM'] ?? 'system.log',
      error: process.env['LOG_FILE_ERROR'] ?? 'error.log',
      access: process.env['LOG_FILE_ACCESS'] ?? 'access.log',
    };
  }

  /**
   * Build logger configuration from environment.
   * @returns {ILoggerConfig} Logger configuration.
   */
  private buildConfig(): ILoggerConfig {
    const DEFAULT_MAX_FILES = 5;
    const DEFAULT_MAX_SIZE = '10m';

    return {
      stateDir: this.getStateDir(),
      logLevel: this.getLogLevel(),
      maxSize: process.env['LOG_MAX_SIZE'] ?? DEFAULT_MAX_SIZE,
      maxFiles:
        process.env['LOG_MAX_FILES'] === undefined
          ? DEFAULT_MAX_FILES
          : parseInt(process.env['LOG_MAX_FILES'], 10),
      outputs: this.getOutputs(),
      files: this.getFiles(),
    };
  }
}

/**
 * Factory function for creating the module.
 * @returns {LoggerModule} Logger module instance.
 */
export const createModule = (): LoggerModule => {
  return new LoggerModule();
};

/**
 * Initialize function for core module pattern.
 * @returns {Promise<LoggerModule>} Initialized logger module.
 */
export const initialize = async (): Promise<LoggerModule> => {
  const loggerModule = new LoggerModule();
  await loggerModule.initialize();
  return loggerModule;
};

/**
 * Get logger service instance.
 * @returns {ILogger} Logger service instance.
 */
export const getLoggerService = (): ILogger => {
  return LoggerService.getInstance();
};

/**
 * Re-export LoggerService.
 */
export { LoggerService };

/**
 * Default export of initialize for module pattern.
 */
export default initialize;
