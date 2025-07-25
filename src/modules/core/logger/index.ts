/**
 * Core logger module - provides system-wide logging.
 * @file Core logger module - provides system-wide logging.
 * @module modules/core/logger
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerInitializationError } from '@/modules/core/logger/utils/errors';
import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import type {
  ILogFiles,
  ILogger,
  ILoggerConfig,
  LogLevelName,
} from '@/modules/core/logger/types/index';
import {
  LogOutput,
  LogSource,
  LoggerMode
} from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for Logger module.
 */
export interface ILoggerModuleExports {
  readonly service: () => ILogger;
  readonly logger: () => ILogger;
  readonly getInstance: () => LoggerService;
}

/**
 * Type guard to check if a module is a Logger module.
 * @param module - Module to check.
 * @returns True if module is a Logger module.
 */
export function isLoggerModule(module: any): module is IModule<ILoggerModuleExports> {
  return module?.name === 'logger'
         && Boolean(module.exports)
         && typeof module.exports === 'object'
         && 'service' in module.exports
         && typeof module.exports.service === 'function';
}

/**
 * Logger module implementation - self-contained.
 * @class LoggerModule
 */
export class LoggerModule implements IModule<ILoggerModuleExports> {
  public readonly name = 'logger';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'System-wide logging service with file and console output';
  public readonly dependencies = [];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private readonly loggerService: LoggerService;
  private initialized = false;
  private started = false;
  get exports(): ILoggerModuleExports {
    return {
      service: () => { return this.getService() },
      logger: () => { return this.getService() },
      getInstance: () => { return LoggerService.getInstance() },
    };
  }

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
      this.loggerService.info(LogSource.LOGGER, 'Logger module initialized successfully', {
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
      this.loggerService.info(LogSource.LOGGER, 'Logger module started');
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
        this.loggerService.info(LogSource.LOGGER, 'Logger module stopping');
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
    this.loggerService.debug(LogSource.LOGGER, 'Health check test log');
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
        return output === LogOutput.CONSOLE || output === LogOutput.FILE || output === LogOutput.DATABASE;
      });
    }
    return [LogOutput.CONSOLE, LogOutput.DATABASE];
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
      mode: this.getLoggerMode(),
      maxSize: process.env['LOG_MAX_SIZE'] ?? DEFAULT_MAX_SIZE,
      maxFiles:
        process.env['LOG_MAX_FILES'] === undefined
          ? DEFAULT_MAX_FILES
          : parseInt(process.env['LOG_MAX_FILES'], 10),
      outputs: this.getOutputs(),
      files: this.getFiles(),
      database: {
        enabled: true,
        tableName: 'system_logs'
      }
    };
  }

  /**
   * Get logger mode from environment or process context.
   * @returns {LoggerMode} Logger mode.
   */
  private getLoggerMode(): LoggerMode {
    if (process.env['LOG_MODE'] === 'cli') {
      return LoggerMode.CLI;
    }

    if (process.argv.length > 2 && process.argv[1]?.includes('cli')) {
      return LoggerMode.CLI;
    }

    return LoggerMode.SERVER;
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
 * Re-export LoggerService and types.
 */
export { LoggerService, LogSource };

/**
 * Export error handling utilities.
 */
export {
 handleError, handleErrorAsync, configureErrorHandling
} from '@/modules/core/logger/utils/handle-error';
export { ErrorHandlingService } from '@/modules/core/logger/services/error-handling.service';

/**
 * Export error classes.
 */
export {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalServiceError,
  BusinessLogicError,
  ConfigurationError
} from '@/modules/core/logger/errors/index';

/**
 * Export error handling types.
 */
export type {
  IErrorContext,
  IProcessedError,
  IErrorHandlingOptions,
  IErrorHandlingConfig,
  ErrorCategory,
  ErrorSeverity,
  ErrorHandler,
  AsyncErrorHandler
} from '@/modules/core/logger/types/error-handling.types';

/**
 * Default export of initialize for module pattern.
 */
export default initialize;
