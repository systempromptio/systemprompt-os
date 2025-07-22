/**
 * @fileoverview Logger service implementation with singleton pattern
 * @module modules/core/logger/services
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { 
  Logger, 
  LoggerConfig, 
  LogLevel, 
  LogLevelName,
  LogContext,
  LogEntry 
} from '@/modules/core/logger/types';
import {
  LoggerError,
  LoggerInitializationError,
  LoggerFileWriteError,
  LoggerFileReadError,
  LoggerDirectoryError,
  InvalidLogLevelError
} from '@/modules/core/logger/utils/errors';

/**
 * Logger service implementation following singleton pattern
 * @class LoggerService
 * @implements {Logger}
 */
export class LoggerService implements Logger {
  private static instance: LoggerService;
  private initialized = false;
  private config!: LoggerConfig;
  private logsDir!: string;
  private readonly logLevels: LogLevel = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance of the logger service
   * @returns {LoggerService} The logger service instance
   */
  static getInstance(): LoggerService {
    if (!this.instance) {
      this.instance = new LoggerService();
    }
    return this.instance;
  }

  /**
   * Initialize the logger service with configuration
   * @param {LoggerConfig} config - Logger configuration
   * @throws {LoggerInitializationError} If initialization fails
   */
  async initialize(config: LoggerConfig): Promise<void> {
    if (this.initialized) {
      throw new LoggerInitializationError('Logger already initialized');
    }

    try {
      this.config = config;
      this.logsDir = join(config.stateDir, 'logs');
      
      // Validate log level
      if (!this.isValidLogLevel(config.logLevel)) {
        throw new InvalidLogLevelError(config.logLevel);
      }

      await this.ensureLogsDirectory();
      this.initialized = true;
    } catch (error) {
      if (error instanceof LoggerError) {
        throw error;
      }
      throw new LoggerInitializationError(
        'Failed to initialize logger',
        error as Error
      );
    }
  }

  /**
   * Ensure the logs directory exists
   * @throws {LoggerDirectoryError} If directory creation fails
   */
  private async ensureLogsDirectory(): Promise<void> {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      throw new LoggerDirectoryError(this.logsDir, error as Error);
    }
  }

  /**
   * Check if a log level is valid
   * @param {string} level - Log level to check
   * @returns {boolean} True if valid
   */
  private isValidLogLevel(level: string): level is LogLevelName {
    return level in this.logLevels;
  }

  /**
   * Check if logging should occur for a given level
   * @param {LogLevelName} level - Log level to check
   * @returns {boolean} True if should log
   */
  private shouldLog(level: LogLevelName): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  /**
   * Format timestamp for log entries
   * @returns {string} ISO formatted timestamp
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message with arguments
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {unknown[]} args - Additional arguments
   * @returns {string} Formatted message
   */
  private formatMessage(level: string, message: string, args: unknown[]): string {
    const formatted =
      args.length > 0
        ? `${message} ${args
            .map((arg) => {
              if (typeof arg === 'object' && arg !== null) {
                try {
                  return JSON.stringify(arg);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            })
            .join(' ')}`
        : message;
    return `[${this.formatTimestamp()}] [${level}] ${formatted}`;
  }

  /**
   * Write log message to file
   * @param {string} filename - Log file name
   * @param {string} message - Log message
   * @throws {LoggerFileWriteError} If write fails
   */
  private writeToFile(filename: string, message: string): void {
    if (!this.config.outputs.includes('file')) return;

    try {
      const filepath = join(this.logsDir, filename);
      appendFileSync(filepath, message + '\n');
    } catch (error) {
      // Log to console as fallback
      console.error('Logger file write error:', error);
      // Don't throw to avoid breaking the application
    }
  }

  /**
   * Write log message to console
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {unknown[]} args - Additional arguments
   */
  private writeToConsole(level: string, message: string, args: unknown[]): void {
    if (!this.config.outputs.includes('console')) return;

    const timestamp = this.formatTimestamp();
    const formattedArgs = args.length > 0 ? [message, ...args] : [message];

    switch (level.toLowerCase()) {
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG]`, ...formattedArgs);
        break;
      case 'info':
        console.log(`[${timestamp}] [INFO]`, ...formattedArgs);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN]`, ...formattedArgs);
        break;
      case 'error':
        console.error(`[${timestamp}] [ERROR]`, ...formattedArgs);
        break;
    }
  }

  /**
   * Check if logger is initialized
   * @throws {LoggerInitializationError} If not initialized
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new LoggerInitializationError('Logger not initialized');
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {...unknown} args - Additional arguments
   */
  debug(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('DEBUG', message, args);
    this.writeToConsole('debug', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {...unknown} args - Additional arguments
   */
  info(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('INFO', message, args);
    this.writeToConsole('info', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {...unknown} args - Additional arguments
   */
  warn(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('WARN', message, args);
    this.writeToConsole('warn', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {...unknown} args - Additional arguments
   */
  error(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('error')) return;
    const formatted = this.formatMessage('ERROR', message, args);
    this.writeToConsole('error', message, args);
    this.writeToFile(this.config.files.system, formatted);
    this.writeToFile(this.config.files.error, formatted);
  }

  /**
   * Add a log with custom level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {...unknown} args - Additional arguments
   */
  addLog(level: string, message: string, ...args: unknown[]): void {
    this.checkInitialized();
    const formatted = this.formatMessage(level.toUpperCase(), message, args);
    this.writeToConsole(level.toLowerCase(), message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Special method for access logs (HTTP requests)
   * @param {string} message - Log message
   */
  access(message: string): void {
    this.checkInitialized();
    const formatted = this.formatMessage('ACCESS', message, []);
    this.writeToFile(this.config.files.access, formatted);
  }

  /**
   * Clear logs from a specific file or all log files
   * @param {string} [logFile] - Specific log file to clear
   * @throws {LoggerFileWriteError} If clear operation fails
   */
  async clearLogs(logFile?: string): Promise<void> {
    this.checkInitialized();

    try {
      if (logFile) {
        // Clear specific log file
        const filepath = join(this.logsDir, logFile);
        if (existsSync(filepath)) {
          await writeFile(filepath, '');
        }
      } else {
        // Clear all log files
        const files = Object.values(this.config.files);
        await Promise.all(
          files.map(async (file) => {
            const filepath = join(this.logsDir, file);
            if (existsSync(filepath)) {
              await writeFile(filepath, '');
            }
          })
        );
      }
    } catch (error) {
      throw new LoggerFileWriteError(
        logFile || 'all log files',
        error as Error
      );
    }
  }

  /**
   * Get logs from a specific file or all logs
   * @param {string} [logFile] - Specific log file to read
   * @returns {Promise<string[]>} Array of log lines
   * @throws {LoggerFileReadError} If read operation fails
   */
  async getLogs(logFile?: string): Promise<string[]> {
    this.checkInitialized();

    try {
      const logs: string[] = [];

      if (logFile) {
        // Get logs from specific file
        const filepath = join(this.logsDir, logFile);
        if (existsSync(filepath)) {
          const content = await readFile(filepath, 'utf-8');
          logs.push(...content.split('\n').filter((line) => line.trim()));
        }
      } else {
        // Get logs from all files
        const files = Object.values(this.config.files);
        await Promise.all(
          files.map(async (file) => {
            const filepath = join(this.logsDir, file);
            if (existsSync(filepath)) {
              const content = await readFile(filepath, 'utf-8');
              logs.push(...content.split('\n').filter((line) => line.trim()));
            }
          })
        );
      }

      return logs;
    } catch (error) {
      throw new LoggerFileReadError(
        logFile || 'log files',
        error as Error
      );
    }
  }

  /**
   * Reset the logger instance (mainly for testing)
   */
  static resetInstance(): void {
    if (this.instance) {
      this.instance.initialized = false;
      this.instance = new LoggerService();
    }
  }
}