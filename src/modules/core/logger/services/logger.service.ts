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
import {
  LogOutput,
  LogSource,
  LoggerMode,
  type ILogLevel,
  type ILogger,
  type ILoggerConfig,
  type LogArgs,
  type LogLevelName,
} from '@/modules/core/logger/types/index';
// Database service interface to avoid direct service dependency
interface ILogDatabaseService {
  execute(sql: string, params?: unknown[]): Promise<void>;
}
import {
  InvalidLogLevelError,
  LoggerDirectoryError,
  LoggerError,
  LoggerFileReadError,
  LoggerFileWriteError,
  LoggerInitializationError,
} from '@/modules/core/logger/utils/errors';

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
  private databaseService?: ILogDatabaseService;

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
      return;
    }

    try {
      this.config = {
        ...config,
        mode: config.mode ?? LoggerMode.SERVER,
      };
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
   * Set the database service for database logging.
   * @param {ILogDatabaseService} databaseService - Database service instance.
   */
  setDatabaseService(databaseService: ILogDatabaseService): void {
    this.databaseService = databaseService;
    if (
      this.config?.database?.enabled === true &&
      this.config.outputs.includes(LogOutput.DATABASE)
    ) {
      this.initializeLogsTable().catch((error: unknown): void => {
        this.writeToStderr(`Failed to initialize logs table: ${String(error)}\n`);
      });
    }
  }

  /**
   * Initialize the logs table in the database.
   * @throws {Error} If database is not available.
   */
  private async initializeLogsTable(): Promise<void> {
    if (this.databaseService === null || this.databaseService === undefined) {
      throw new Error('Database service not available');
    }

    const schemaPath = join(import.meta.url.replace('file://', ''), '../../../database/schema.sql');
    if (existsSync(schemaPath)) {
      const schema = await readFile(schemaPath, 'utf-8');
      await this.databaseService.execute(schema);
    }
  }

  /**
   * Log debug message.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Optional args.
   */
  debug(source: LogSource, message: string, args: LogArgs = {}): void {
    this.log('debug', source, message, args);
  }

  /**
   * Log info message.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Optional args.
   */
  info(source: LogSource, message: string, args: LogArgs = {}): void {
    this.log('info', source, message, args);
  }

  /**
   * Log warning message.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Optional args.
   */
  warn(source: LogSource, message: string, args: LogArgs = {}): void {
    this.log('warn', source, message, args);
  }

  /**
   * Log error message.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Optional args.
   */
  error(source: LogSource, message: string, args: LogArgs = {}): void {
    this.log('error', source, message, args);
  }

  /**
   * Log with custom level.
   * @param {LogLevelName} level - Log level.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Optional args.
   */
  log(level: LogLevelName, source: LogSource, message: string, args: LogArgs = {}): void {
    this.checkInitialized();

    const shouldLogToConsole = this.shouldLogToConsole(level);
    const shouldLogToFile = this.shouldLogToFile(level);
    const shouldLogToDatabase = args.persistToDb !== false && this.shouldLogToDatabase(level);

    if (!shouldLogToConsole && !shouldLogToFile && !shouldLogToDatabase) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const formatted = this.formatMessage(level.toUpperCase(), source, message, args);

    if (shouldLogToConsole) {
      this.writeToConsole(level, source, message, args);
    }
    if (shouldLogToFile) {
      this.writeToFile(this.config.files.system, formatted);
      if (level === 'error') {
        this.writeToFile(this.config.files.error, formatted);
      }
    }
    if (shouldLogToDatabase) {
      this.writeToDatabase(level, source, message, args, timestamp);
    }
  }

  /**
   * Special method for access logs (HTTP requests).
   * @param {string} message - Log message.
   */
  access(message: string): void {
    this.checkInitialized();
    const formatted = this.formatMessage('ACCESS', LogSource.ACCESS, message, {});
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
   * Check if should log to console for a given level.
   * @param {LogLevelName} level - Log level to check.
   * @returns {boolean} True if should log to console.
   */
  private shouldLogToConsole(level: LogLevelName): boolean {
    if (!this.config.outputs.includes(LogOutput.CONSOLE)) {
      return false;
    }

    if (this.config.mode === LoggerMode.CLI) {
      return level === 'warn' || level === 'error';
    }

    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  /**
   * Check if should log to file for a given level.
   * @param {LogLevelName} level - Log level to check.
   * @returns {boolean} True if should log to file.
   */
  private shouldLogToFile(level: LogLevelName): boolean {
    if (!this.config.outputs.includes(LogOutput.FILE)) {
      return false;
    }
    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  /**
   * Check if should log to database for a given level.
   * Only important logs (warn and error) should be saved to DB to reduce storage overhead.
   * @param {LogLevelName} level - Log level to check.
   * @returns {boolean} True if should log to database.
   */
  private shouldLogToDatabase(level: LogLevelName): boolean {
    if (
      !this.config.outputs.includes(LogOutput.DATABASE)
      || !this.config.database?.enabled
      || !this.databaseService
    ) {
      return false;
    }

    return level === 'warn' || level === 'error';
  }

  /**
   * Format timestamp for log entries.
   * @returns {string} ISO formatted timestamp.
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message with source and args.
   * @param {string} level - Log level.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Additional args.
   * @returns {string} Formatted message.
   */
  private formatMessage(level: string, source: LogSource, message: string, args: LogArgs): string {
    const timestamp = this.formatTimestamp();
    const category = args.category ? `[${args.category}]` : '';
    const requestId = args.requestId ? `[req:${args.requestId}]` : '';
    const userId = args.userId ? `[user:${args.userId}]` : '';
    const duration = args.duration ? `[${args.duration}ms]` : '';

    return `[${timestamp}] [${level}] [${source}]${category}${requestId}${userId}${duration} ${message}`;
  }

  /**
   * Write log message to file.
   * @param {string} filename - Log file name.
   * @param {string} message - Log message.
   * @throws {LoggerFileWriteError} If write fails.
   */
  private writeToFile(filename: string, message: string): void {
    if (!this.config.outputs.includes(LogOutput.FILE)) {
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
   * Write log message to database.
   * @param {LogLevelName} level - Log level.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Additional args.
   * @param {string} timestamp - Timestamp.
   */
  private writeToDatabase(
    level: LogLevelName,
    source: LogSource,
    message: string,
    args: LogArgs,
    timestamp: string,
  ): void {
    if (!this.databaseService || !this.config.database?.enabled) {
      return;
    }

    try {
      const tableName = this.config.database.tableName || 'system_logs';
      const argsJson = JSON.stringify(args);

      this.databaseService
        .execute(
          `INSERT INTO ${tableName} (timestamp, level, source, category, message, args) VALUES (?, ?, ?, ?, ?, ?)`,
          [timestamp, level, source, args.category || null, message, argsJson],
        )
        .catch((error) => {
          this.writeToStderr(`Logger database write error: ${String(error)}\n`);
        });
    } catch (error) {
      this.writeToStderr(`Logger database write error: ${String(error)}\n`);
    }
  }

  /**
   * Write log message to console.
   * @param {string} level - Log level.
   * @param {LogSource} source - Source module or component.
   * @param {string} message - Log message.
   * @param {LogArgs} args - Additional args.
   */
  private writeToConsole(level: string, source: LogSource, message: string, args: LogArgs): void {
    if (!this.config.outputs.includes(LogOutput.CONSOLE)) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const category = args.category ? `[${args.category}]` : '';
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${source}]${category} ${message}\n`;

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
