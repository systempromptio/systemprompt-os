/**
 * @fileoverview Core logger module - provides system-wide logging
 * @module modules/core/logger
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { ServiceModule, ModuleConfig } from "../../registry.js";

export interface LogLevel {
  debug: number;
  info: number;
  warn: number;
  error: number;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  addLog(level: string, message: string, ...args: any[]): void;
  clearLogs(logFile?: string): Promise<void>;
  getLogs(logFile?: string): Promise<string[]>;
}

// Re-export for convenience
export type { Logger as ILogger };

export interface LoggerConfig {
  stateDir: string;
  logLevel: keyof LogLevel;
  maxSize: string;
  maxFiles: number;
  outputs: ("console" | "file")[];
  files: {
    system: string;
    error: string;
    access: string;
  };
}

export class LoggerModule implements ServiceModule {
  public readonly name = "logger";
  public readonly type = "service" as const;
  public readonly version = "1.0.0";
  public readonly description = "System-wide logging service with file and console output";

  private loggerConfig: LoggerConfig;
  public config?: ModuleConfig;
  private logsDir: string;
  private logLevels: LogLevel = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: LoggerConfig) {
    this.loggerConfig = config;
    this.logsDir = join(config.stateDir, "logs");
    this.ensureLogsDirectory();
  }

  async initialize(_context: any): Promise<void> {
    // Logger is ready immediately
  }

  async start(): Promise<void> {
    // Logger starts immediately
  }

  async stop(): Promise<void> {
    // Flush any pending logs if needed
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check if logs directory is writable
      const testFile = join(this.logsDir, '.health-check');
      const { writeFileSync, unlinkSync } = await import('fs');
      writeFileSync(testFile, 'test');
      unlinkSync(testFile);
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Logger health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }

  getService(): Logger {
    return {
      debug: this.debug.bind(this),
      info: this.info.bind(this),
      warn: this.warn.bind(this),
      error: this.error.bind(this),
      addLog: this.addLog.bind(this),
      clearLogs: this.clearLogs.bind(this),
      getLogs: this.getLogs.bind(this),
    };
  }

  private ensureLogsDirectory(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private shouldLog(level: keyof LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.loggerConfig.logLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const formatted =
      args.length > 0
        ? `${message} ${args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
            .join(" ")}`
        : message;
    return `[${this.formatTimestamp()}] [${level}] ${formatted}`;
  }

  private writeToFile(filename: string, message: string): void {
    if (!this.loggerConfig.outputs.includes("file")) return;

    try {
      const filepath = join(this.logsDir, filename);
      appendFileSync(filepath, message + "\n");
    } catch (error) {
      // Fallback to console if file write fails
      console.error("Logger file write error:", error);
    }
  }

  private writeToConsole(level: string, message: string, args: any[]): void {
    if (!this.loggerConfig.outputs.includes("console")) return;

    const timestamp = this.formatTimestamp();
    const formattedArgs = args.length > 0 ? [message, ...args] : [message];

    switch (level.toLowerCase()) {
      case "debug":
        console.debug(`[${timestamp}] [DEBUG]`, ...formattedArgs);
        break;
      case "info":
        console.log(`[${timestamp}] [INFO]`, ...formattedArgs);
        break;
      case "warn":
        console.warn(`[${timestamp}] [WARN]`, ...formattedArgs);
        break;
      case "error":
        console.error(`[${timestamp}] [ERROR]`, ...formattedArgs);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    if (!this.shouldLog("debug")) return;
    const formatted = this.formatMessage("DEBUG", message, args);
    this.writeToConsole("debug", message, args);
    this.writeToFile(this.loggerConfig.files.system, formatted);
  }

  info(message: string, ...args: any[]): void {
    if (!this.shouldLog("info")) return;
    const formatted = this.formatMessage("INFO", message, args);
    this.writeToConsole("info", message, args);
    this.writeToFile(this.loggerConfig.files.system, formatted);
  }

  warn(message: string, ...args: any[]): void {
    if (!this.shouldLog("warn")) return;
    const formatted = this.formatMessage("WARN", message, args);
    this.writeToConsole("warn", message, args);
    this.writeToFile(this.loggerConfig.files.system, formatted);
  }

  error(message: string, ...args: any[]): void {
    if (!this.shouldLog("error")) return;
    const formatted = this.formatMessage("ERROR", message, args);
    this.writeToConsole("error", message, args);
    this.writeToFile(this.loggerConfig.files.system, formatted);
    this.writeToFile(this.loggerConfig.files.error, formatted);
  }

  /**
   * Special method for access logs (HTTP requests)
   */
  access(message: string): void {
    const formatted = this.formatMessage("ACCESS", message, []);
    this.writeToFile(this.loggerConfig.files.access, formatted);
  }

  /**
   * Add a log with custom level
   */
  addLog(level: string, message: string, ...args: any[]): void {
    const formatted = this.formatMessage(level.toUpperCase(), message, args);
    this.writeToConsole(level.toLowerCase(), message, args);
    this.writeToFile(this.loggerConfig.files.system, formatted);
  }

  /**
   * Clear logs from a specific file or all log files
   */
  async clearLogs(logFile?: string): Promise<void> {
    const { writeFileSync } = await import("fs");

    if (logFile) {
      // Clear specific log file
      const filepath = join(this.logsDir, logFile);
      if (existsSync(filepath)) {
        writeFileSync(filepath, "");
      }
    } else {
      // Clear all log files
      const files = Object.values(this.loggerConfig.files);
      for (const file of files) {
        const filepath = join(this.logsDir, file);
        if (existsSync(filepath)) {
          writeFileSync(filepath, "");
        }
      }
    }
  }

  /**
   * Get logs from a specific file or all logs
   */
  async getLogs(logFile?: string): Promise<string[]> {
    const { readFileSync } = await import("fs");
    const logs: string[] = [];

    if (logFile) {
      // Get logs from specific file
      const filepath = join(this.logsDir, logFile);
      if (existsSync(filepath)) {
        const content = readFileSync(filepath, "utf-8");
        logs.push(...content.split("\n").filter((line) => line.trim()));
      }
    } else {
      // Get logs from all files
      const files = Object.values(this.loggerConfig.files);
      for (const file of files) {
        const filepath = join(this.logsDir, file);
        if (existsSync(filepath)) {
          const content = readFileSync(filepath, "utf-8");
          logs.push(...content.split("\n").filter((line) => line.trim()));
        }
      }
    }

    return logs;
  }
}

// Export factory function for module system
export function createModule(config: LoggerConfig): LoggerModule {
  return new LoggerModule(config);
}
