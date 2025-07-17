/**
 * @fileoverview Logger utility - provides a simple logger until module system is ready
 * @module utils/logger
 * 
 * This is a temporary implementation that will be replaced by the logger module
 * once the module system is fully initialized.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../server/config.js';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

class SimpleLogger implements Logger {
  private logsDir: string;
  
  constructor() {
    this.logsDir = join(CONFIG.STATE_DIR, 'logs');
    this.ensureLogsDirectory();
  }
  
  private ensureLogsDirectory(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }
  
  private formatTimestamp(): string {
    return new Date().toISOString();
  }
  
  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.formatTimestamp()}] [DEBUG]`, message, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    console.log(`[${this.formatTimestamp()}] [INFO]`, message, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.formatTimestamp()}] [WARN]`, message, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(`[${this.formatTimestamp()}] [ERROR]`, message, ...args);
  }
}

// Export singleton instance
export const logger = new SimpleLogger();