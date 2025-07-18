/**
 * @fileoverview Heartbeat daemon module for system health monitoring
 * @module modules/core/heartbeat
 * @author SystemPrompt OS
 * @version 1.0.0
 * 
 * This module provides a daemon that periodically writes system health status
 * to a JSON file. It monitors CPU usage, memory consumption, and system uptime,
 * making this data available for external monitoring tools.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, loadavg, totalmem, freemem } from 'node:os';
import type { DaemonModule, ModuleConfig } from '../../registry.js';
import type { 
  HeartbeatConfig, 
  HeartbeatStatus, 
  HeartbeatMetric,
  MemoryInfo,
  CpuInfo,
  TimeUnit,
  LogLevel
} from './types.js';
import type { Logger } from '../logger/index.js';

/**
 * HeartbeatModule implements a system health monitoring daemon
 * 
 * @class HeartbeatModule
 * @implements {DaemonModule}
 * 
 * @example
 * ```typescript
 * const heartbeat = new HeartbeatModule({
 *   interval: '30s',
 *   outputPath: '/var/log/heartbeat/status.json',
 *   autoStart: true,
 *   includeMetrics: ['timestamp', 'status', 'memory', 'cpu']
 * });
 * 
 * await heartbeat.initialize();
 * ```
 */
export class HeartbeatModule implements DaemonModule {
  /**
   * Module identifier
   */
  public readonly name = 'heartbeat' as const;
  
  /**
   * Module type identifier for the system
   */
  public readonly type = 'daemon' as const;
  
  /**
   * Module version following semantic versioning
   */
  public readonly version = '1.0.0' as const;
  
  /**
   * Human-readable description of the module's purpose
   */
  public readonly description = 'System health monitoring daemon that writes status JSON every 30 seconds' as const;
  
  /**
   * Heartbeat-specific configuration
   */
  private readonly heartbeatConfig: Required<HeartbeatConfig>;
  
  /**
   * Module configuration for registry
   */
  public readonly config?: ModuleConfig;
  
  /**
   * Interval timer reference for cleanup
   */
  private intervalId?: NodeJS.Timeout;
  
  /**
   * Timestamp when the module was started (in milliseconds since epoch)
   */
  private readonly startTime: number;
  
  /**
   * Current running state of the daemon
   */
  private running = false;
  
  /**
   * Logger instance for structured logging
   */
  private logger?: Logger;
  
  /**
   * Default metrics to include if not specified in config
   */
  private static readonly DEFAULT_METRICS: HeartbeatMetric[] = [
    'timestamp', 'status', 'uptime', 'memory', 'cpu', 'version'
  ];
  
  /**
   * Default interval if parsing fails (30 seconds)
   */
  private static readonly DEFAULT_INTERVAL_MS = 30000;

  /**
   * Creates a new HeartbeatModule instance
   * 
   * @param {HeartbeatConfig} config - Configuration options for the heartbeat daemon
   * @param {Logger} [logger] - Optional logger instance for structured logging
   * @throws {Error} If required configuration fields are missing or invalid
   */
  constructor(config: HeartbeatConfig, logger?: Logger) {
    this.validateConfig(config);
    
    // Merge with defaults
    this.heartbeatConfig = {
      autoStart: false,
      includeMetrics: HeartbeatModule.DEFAULT_METRICS,
      ...config
    };
    
    this.startTime = Date.now();
    this.logger = logger;
  }
  
  /**
   * Sets the logger instance after construction
   * Useful for dependency injection scenarios
   * 
   * @param {Logger} logger - Logger instance to use for logging
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }
  
  /**
   * Logs a message with the specified level
   * Falls back to console.log if no logger is available
   * 
   * @private
   * @param {LogLevel} level - Log level (debug, info, warn, error)
   * @param {string} message - Message to log
   * @param {...unknown[]} args - Additional arguments to pass to the logger
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const prefixedMessage = `[Heartbeat] ${message}`;
    
    if (this.logger) {
      switch (level) {
        case 'debug':
          this.logger.debug(prefixedMessage, ...args);
          break;
        case 'info':
          this.logger.info(prefixedMessage, ...args);
          break;
        case 'warn':
          this.logger.warn(prefixedMessage, ...args);
          break;
        case 'error':
          this.logger.error(prefixedMessage, ...args);
          break;
      }
    } else {
      // Fallback to console with timestamp
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${prefixedMessage}`, ...args);
    }
  }
  
  /**
   * Validates the configuration object
   * 
   * @private
   * @param {HeartbeatConfig} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  private validateConfig(config: HeartbeatConfig): void {
    if (!config.interval) {
      throw new Error('Heartbeat config missing required field: interval');
    }
    
    if (!config.outputPath) {
      throw new Error('Heartbeat config missing required field: outputPath');
    }
    
    if (typeof config.interval !== 'string') {
      throw new Error('Heartbeat config interval must be a string');
    }
    
    if (typeof config.outputPath !== 'string') {
      throw new Error('Heartbeat config outputPath must be a string');
    }
    
    // Validate interval format
    const intervalMs = this.parseInterval(config.interval);
    if (intervalMs === null) {
      throw new Error('Invalid interval format. Use format like "500ms", "30s", "5m", "1h"');
    }
    
    // Validate minimum interval (100ms)
    if (intervalMs < 100) {
      throw new Error('Interval must be at least 100ms');
    }
  }
  
  /**
   * Parses an interval string into milliseconds
   * 
   * @private
   * @param {string} interval - Interval string (e.g., "30s", "5m")
   * @returns {number | null} Milliseconds or null if invalid format
   * 
   * @example
   * parseInterval("30s") // returns 30000
   * parseInterval("5m")  // returns 300000
   * parseInterval("1h")  // returns 3600000
   */
  private parseInterval(interval: string): number | null {
    const match = interval.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) {
      return null;
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2] as TimeUnit;
    
    if (isNaN(value) || value <= 0) {
      return null;
    }
    
    const multipliers: Record<TimeUnit, number> = {
      'ms': 1,
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000
    };
    
    return value * multipliers[unit];
  }
  
  /**
   * Gets the configured interval in milliseconds
   * 
   * @returns {number} Interval in milliseconds
   */
  public getIntervalMs(): number {
    return this.parseInterval(this.heartbeatConfig.interval) ?? HeartbeatModule.DEFAULT_INTERVAL_MS;
  }
  
  /**
   * Initializes the heartbeat module
   * Starts the daemon if autoStart is enabled
   * 
   * @returns {Promise<void>}
   */
  public async initialize(): Promise<void> {
    this.log('info', `Initializing with interval ${this.heartbeatConfig.interval}`);
    
    if (this.heartbeatConfig.autoStart) {
      await this.start();
    }
  }
  
  /**
   * Shuts down the heartbeat module
   * Stops the daemon and cleans up resources
   * 
   * @returns {Promise<void>}
   */
  public async shutdown(): Promise<void> {
    this.log('info', 'Shutting down');
    await this.stop();
  }
  
  /**
   * Starts the heartbeat daemon
   * Begins writing status at the configured interval
   * 
   * @returns {Promise<void>}
   * @throws {Error} If daemon is already running
   */
  public async start(): Promise<void> {
    if (this.running) {
      this.log('warn', 'Already running');
      return;
    }
    
    this.log('info', 'Starting daemon');
    this.running = true;
    
    // Write initial status
    this.writeStatus();
    
    // Set up interval
    const intervalMs = this.getIntervalMs();
    this.intervalId = setInterval(() => {
      this.writeStatus();
    }, intervalMs);
    
    this.log('info', `Daemon started with ${intervalMs}ms interval`);
  }
  
  /**
   * Stops the heartbeat daemon
   * Clears the interval timer and updates running state
   * 
   * @returns {Promise<void>}
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      this.log('warn', 'Not running');
      return;
    }
    
    this.log('info', 'Stopping daemon');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    this.running = false;
    this.log('info', 'Daemon stopped');
  }
  
  /**
   * Checks if the daemon is currently running
   * 
   * @returns {boolean} True if the daemon is active
   */
  public isRunning(): boolean {
    return this.running;
  }
  
  /**
   * Health check for the module
   * 
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health status
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.running) {
      return { healthy: false, message: 'Heartbeat daemon is not running' };
    }
    
    // Check if heartbeat file was written recently
    try {
      const heartbeatPath = this.heartbeatConfig.outputPath;
      const { statSync } = await import('node:fs');
      const stats = statSync(heartbeatPath);
      const lastWriteTime = stats.mtime.getTime();
      const now = Date.now();
      const intervalMs = this.getIntervalMs();
      
      // Allow 2x interval time for health check
      if (now - lastWriteTime > intervalMs * 2) {
        return { 
          healthy: false, 
          message: `Heartbeat file is stale (last write: ${new Date(lastWriteTime).toISOString()})` 
        };
      }
      
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Failed to check heartbeat file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  /**
   * Generates memory information
   * 
   * @private
   * @returns {MemoryInfo} Memory usage statistics
   */
  private generateMemoryInfo(): MemoryInfo {
    const total = totalmem();
    const free = freemem();
    const used = total - free;
    
    return {
      used: Math.round(used / 1024 / 1024), // Convert to MB
      total: Math.round(total / 1024 / 1024), // Convert to MB
      percentage: Math.round((used / total) * 100)
    };
  }
  
  /**
   * Generates CPU information
   * 
   * @private
   * @returns {CpuInfo} CPU usage statistics
   */
  private generateCpuInfo(): CpuInfo {
    const loads = loadavg();
    const cpuCount = cpus().length;
    
    // Calculate usage percentage based on 1-minute load average
    // Load average of 1.0 per CPU core = 100% usage
    const usage = Math.min(100, Math.round((loads[0] / cpuCount) * 100));
    
    return {
      usage,
      loadAverage: loads as [number, number, number]
    };
  }
  
  /**
   * Generates the current system health status
   * 
   * @returns {HeartbeatStatus} Current system health metrics
   */
  public generateStatus(): HeartbeatStatus {
    const status: HeartbeatStatus = {
      timestamp: new Date().toISOString(),
      status: 'healthy'
    };
    
    const metrics = this.heartbeatConfig.includeMetrics;
    
    // Add uptime if requested
    if (metrics.includes('uptime')) {
      status.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }
    
    // Add memory info if requested
    if (metrics.includes('memory')) {
      status.memory = this.generateMemoryInfo();
      
      // Update health status based on memory usage
      if (status.memory.percentage > 90) {
        status.status = 'unhealthy';
      } else if (status.memory.percentage > 80) {
        status.status = 'degraded';
      }
    }
    
    // Add CPU info if requested
    if (metrics.includes('cpu')) {
      status.cpu = this.generateCpuInfo();
      
      // Update health status based on CPU usage
      if (status.cpu.usage > 90 && status.status === 'healthy') {
        status.status = 'degraded';
      }
    }
    
    // Add version if requested
    if (metrics.includes('version')) {
      status.version = this.version;
    }
    
    return status;
  }
  
  /**
   * Writes the current status to the configured output file
   * Creates the directory if it doesn't exist
   * 
   * @throws {Error} If write fails (caught internally, logged but not propagated)
   */
  public writeStatus(): void {
    try {
      const status = this.generateStatus();
      
      // Ensure directory exists
      const dir = dirname(this.heartbeatConfig.outputPath);
      mkdirSync(dir, { recursive: true });
      
      // Write status to file with pretty formatting
      writeFileSync(
        this.heartbeatConfig.outputPath,
        JSON.stringify(status, null, 2),
        'utf-8'
      );
      
      this.log('debug', `Status written to ${this.heartbeatConfig.outputPath}`);
    } catch (error) {
      // Log error but don't throw - daemon should continue running
      this.log('error', 'Failed to write status:', error);
    }
  }
}