/**
 * Logger service implementation with singleton pattern.
 * @file Logger service implementation with singleton pattern.
 * @module modules/core/logger/services
 */

import {
 appendFileSync, existsSync, mkdirSync
} from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type {
  ILogLevel,
  ILogger,
  ILoggerConfig,
  LogLevelName,
} from '@/modules/core/logger/types/index.js';
import {
  InvalidLogLevelError,
  LoggerDirectoryError,
  LoggerError,
  LoggerFileReadError,
  LoggerFileWriteError,
  LoggerInitializationError,
} from '@/modules/core/logger/utils/errors.js';

/**
 * Logger service implementation following singleton pattern.
 * @class LoggerService
 * @implements {ILogger}
 */
export class LoggerService implements ILogger {
  /**
   * Singleton instance.
   */
  private static instance: LoggerService | undefined;
  private readonly logLevels: ILogLevel = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  private initialized = false;
  private config!: ILoggerConfig;
  private logsDir!: string;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    Object.setPrototypeOf(this, LoggerService.prototype);
  }

  /**
   * Get singleton instance of the logger service.
   * @returns {LoggerService} The logger service instance.
   */
  static getInstance(): LoggerService {
    this.instance ??= new LoggerService();
    return this.instance;
  }

  /**
   * Reset the logger instance (mainly for testing).
   */
  static resetInstance(): void {
    if (this.instance !== undefined) {
      this.instance.initialized = false;
      this.instance = new LoggerService();
    }
  }

  /**
   * Initialize the logger service with configuration.
   * @param {ILoggerConfig} config - Logger configuration.
   * @throws {LoggerInitializationError} If initialization fails.
   */
  initialize(config: ILoggerConfig): void {
    if (this.initialized) {
      throw new LoggerInitializationError('Logger already initialized');
    }

    try {
      this.config = config;
      this.logsDir = join(config.stateDir, 'logs');

      if (!this.isValidLogLevel(config.logLevel)) {
        throw new InvalidLogLevelError(config.logLevel);
      }

      this.ensureLogsDirectory();
      this.initialized = true;
    } catch (error) {
      if (error instanceof LoggerError) {
        throw error;
      }
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new LoggerInitializationError('Failed to initialize logger', errorObj);
    }
  }

  /**
   * Log debug message.
   * @param {string} message - Log message.
   * @param {...unknown} args - Additional arguments.
   */
  debug(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('debug')) {
      return;
    }
    const formatted = this.formatMessage('DEBUG', message, args);
    this.writeToConsole('debug', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log info message.
   * @param {string} message - Log message.
   * @param {...unknown} args - Additional arguments.
   */
  info(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('info')) {
      return;
    }
    const formatted = this.formatMessage('INFO', message, args);
    this.writeToConsole('info', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log warning message.
   * @param {string} message - Log message.
   * @param {...unknown} args - Additional arguments.
   */
  warn(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('warn')) {
      return;
    }
    const formatted = this.formatMessage('WARN', message, args);
    this.writeToConsole('warn', message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Log error message.
   * @param {string} message - Log message.
   * @param {...unknown} args - Additional arguments.
   */
  error(message: string, ...args: unknown[]): void {
    this.checkInitialized();
    if (!this.shouldLog('error')) {
      return;
    }
    const formatted = this.formatMessage('ERROR', message, args);
    this.writeToConsole('error', message, args);
    this.writeToFile(this.config.files.system, formatted);
    this.writeToFile(this.config.files.error, formatted);
  }

  /**
   * Add a log with custom level.
   * @param {string} level - Log level.
   * @param {string} message - Log message.
   * @param {...unknown} args - Additional arguments.
   */
  addLog(level: string, message: string, ...args: unknown[]): void {
    this.checkInitialized();
    const formatted = this.formatMessage(level.toUpperCase(), message, args);
    this.writeToConsole(level.toLowerCase(), message, args);
    this.writeToFile(this.config.files.system, formatted);
  }

  /**
   * Special method for access logs (HTTP requests).
   * @param {string} message - Log message.
   */
  access(message: string): void {
    this.checkInitialized();
    const formatted = this.formatMessage('ACCESS', message, []);
    this.writeToFile(this.config.files.access, formatted);
  }

  /**
   * Clear logs from a specific file or all log files.
   * @param {string} [logFile] - Specific log file to clear.
   * @throws {LoggerFileWriteError} If clear operation fails.
   */
  async clearLogs(logFile?: string): Promise<void> {
    this.checkInitialized();

    try {
      if (logFile !== undefined && logFile !== '') {
        const filepath = join(this.logsDir, logFile);
        if (existsSync(filepath)) {
          await writeFile(filepath, '');
        }
      } else {
        const files = Object.values(this.config.files);
        await Promise.all(
          files.map(async (file): Promise<void> => {
            const filepath = join(this.logsDir, String(file));
            if (existsSync(filepath)) {
              await writeFile(filepath, '');
            }
          }),
        );
      }
    } catch (error) {
      throw new LoggerFileWriteError(
        logFile ?? 'all log files',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get logs from a specific file or all logs.
   * @param {string} [logFile] - Specific log file to read.
   * @returns {Promise<string[]>} Array of log lines.
   * @throws {LoggerFileReadError} If read operation fails.
   */
  async getLogs(logFile?: string): Promise<string[]> {
    this.checkInitialized();

    try {
      const logs: string[] = [];

      if (logFile !== undefined && logFile !== '') {
        const filepath = join(this.logsDir, logFile);
        if (existsSync(filepath)) {
          const content = await readFile(filepath, 'utf-8');
          logs.push(
            ...content.split('\n').filter((line): boolean => {
              return line.trim() !== '';
            }),
          );
        }
      } else {
        const files = Object.values(this.config.files);
        await Promise.all(
          files.map(async (file): Promise<void> => {
            const filepath = join(this.logsDir, String(file));
            if (existsSync(filepath)) {
              const content = await readFile(filepath, 'utf-8');
              logs.push(
                ...content.split('\n').filter((line): boolean => {
                  return line.trim() !== '';
                }),
              );
            }
          }),
        );
      }

      return logs;
    } catch (error) {
      throw new LoggerFileReadError(
        logFile ?? 'log files',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Ensure the logs directory exists.
   * @throws {LoggerDirectoryError} If directory creation fails.
   */
  private ensureLogsDirectory(): void {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new LoggerDirectoryError(this.logsDir, errorObj);
    }
  }

  /**
   * Check if a log level is valid.
   * @param {string} level - Log level to check.
   * @returns {boolean} True if valid.
   */
  private isValidLogLevel(level: string): level is LogLevelName {
    return level in this.logLevels;
  }

  /**
   * Check if logging should occur for a given level.
   * @param {LogLevelName} level - Log level to check.
   * @returns {boolean} True if should log.
   */
  private shouldLog(level: LogLevelName): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  /**
   * Format timestamp for log entries.
   * @returns {string} ISO formatted timestamp.
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message with arguments.
   * @param {string} level - Log level.
   * @param {string} message - Log message.
   * @param {unknown[]} args - Additional arguments.
   * @returns {string} Formatted message.
   */
  private formatMessage(level: string, message: string, args: unknown[]): string {
    const formatted
      = args.length > Number('0')
        ? `${message} ${args
            .map((arg): string => {
              if (typeof arg === 'object' && arg !== null) {
                try {
                  return JSON.stringify(arg);
                } catch {
                  return Object.prototype.toString.call(arg);
                }
              }
              return String(arg);
            })
            .join(' ')}`
        : message;
    return `[${this.formatTimestamp()}] [${level}] ${formatted}`;
  }

  /**
   * Write log message to file.
   * @param {string} filename - Log file name.
   * @param {string} message - Log message.
   * @throws {LoggerFileWriteError} If write fails.
   */
  private writeToFile(filename: string, message: string): void {
    if (!this.config.outputs.includes('file')) {
      return;
    }

    try {
      const filepath = join(this.logsDir, filename);
      appendFileSync(filepath, `${message}\n`);
    } catch (error) {
      this.writeToStderr(`Logger file write error: ${String(error)}\n`);
    }
  }

  /**
   * Write log message to console.
   * @param {string} level - Log level.
   * @param {string} message - Log message.
   * @param {unknown[]} args - Additional arguments.
   */
  private writeToConsole(level: string, message: string, args: unknown[]): void {
    if (!this.config.outputs.includes('console')) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const hasArgs = args.length > 0;
    const formattedMessage = hasArgs ? `${message} ${args.join(' ')}` : message;
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}\n`;

    if (level === 'error' || level === 'warn') {
      this.writeToStderr(logMessage);
    } else {
      this.writeToStdout(logMessage);
    }
  }

  /**
   * Write to stdout.
   * @param {string} message - Message to write.
   */
  private writeToStdout(message: string): void {
    process.stdout.write(message);
  }

  /**
   * Write to stderr.
   * @param {string} message - Message to write.
   */
  private writeToStderr(message: string): void {
    process.stderr.write(message);
  }

  /**
   * Check if logger is initialized.
   * @throws {LoggerInitializationError} If not initialized.
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new LoggerInitializationError('Logger not initialized');
    }
  }
}
