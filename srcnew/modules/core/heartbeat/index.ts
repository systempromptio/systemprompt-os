/**
 * Heartbeat daemon module
 * Writes system health status to a JSON file at regular intervals
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { cpus, loadavg, totalmem, freemem } from 'os';
import { DaemonModule } from '../../../src/interfaces/daemon.js';
import { HeartbeatConfig, HeartbeatStatus } from './types.js';
import type { Logger } from '../logger/index.js';

export class HeartbeatModule implements DaemonModule {
  public readonly name = 'heartbeat';
  public readonly type = 'daemon' as const;
  public readonly version = '1.0.0';
  public readonly description = 'System health monitoring daemon that writes status JSON every 30 seconds';
  
  public readonly config: HeartbeatConfig;
  private intervalId?: NodeJS.Timeout;
  private startTime: number;
  private running = false;
  private logger?: Logger;
  
  constructor(config: HeartbeatConfig, logger?: Logger) {
    this.validateConfig(config);
    this.config = {
      autoStart: false,
      includeMetrics: ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version'],
      ...config
    };
    this.startTime = Date.now();
    this.logger = logger;
  }
  
  /**
   * Set the logger after construction (for dependency injection)
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }
  
  private log(level: string, message: string, ...args: any[]): void {
    if (this.logger) {
      // Use appropriate logger method based on level
      switch (level.toLowerCase()) {
        case 'debug':
          this.logger.debug(`[Heartbeat] ${message}`, ...args);
          break;
        case 'info':
          this.logger.info(`[Heartbeat] ${message}`, ...args);
          break;
        case 'warn':
          this.logger.warn(`[Heartbeat] ${message}`, ...args);
          break;
        case 'error':
          this.logger.error(`[Heartbeat] ${message}`, ...args);
          break;
        default:
          this.logger.addLog(level, `[Heartbeat] ${message}`, ...args);
      }
    } else {
      // Fallback to console if no logger available
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] [Heartbeat] ${message}`, ...args);
    }
  }
  
  private validateConfig(config: HeartbeatConfig): void {
    if (!config.interval) {
      throw new Error('Heartbeat config missing required field: interval');
    }
    if (!config.outputPath) {
      throw new Error('Heartbeat config missing required field: outputPath');
    }
    
    // Validate interval format
    if (!this.parseInterval(config.interval)) {
      throw new Error('Invalid interval format. Use format like "500ms", "30s", "5m", "1h"');
    }
  }
  
  private parseInterval(interval: string): number | null {
    const match = interval.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return null;
    }
  }
  
  public getIntervalMs(): number {
    return this.parseInterval(this.config.interval) || 30000;
  }
  
  public async initialize(): Promise<void> {
    this.log('info', `Initializing with interval ${this.config.interval}`);
    
    if (this.config.autoStart) {
      await this.start();
    }
  }
  
  public async shutdown(): Promise<void> {
    this.log('info', 'Shutting down');
    await this.stop();
  }
  
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
  }
  
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
  }
  
  public isRunning(): boolean {
    return this.running;
  }
  
  public generateStatus(): HeartbeatStatus {
    const status: HeartbeatStatus = {
      timestamp: new Date().toISOString(),
      status: 'healthy'
    };
    
    const metrics = this.config.includeMetrics || [];
    
    if (metrics.includes('uptime')) {
      status.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }
    
    if (metrics.includes('memory')) {
      const total = totalmem();
      const free = freemem();
      const used = total - free;
      
      status.memory = {
        used: Math.round(used / 1024 / 1024), // MB
        total: Math.round(total / 1024 / 1024), // MB
        percentage: Math.round((used / total) * 100)
      };
    }
    
    if (metrics.includes('cpu')) {
      const loads = loadavg();
      const cpuCount = cpus().length;
      
      status.cpu = {
        usage: Math.round((loads[0] / cpuCount) * 100),
        loadAverage: loads
      };
    }
    
    if (metrics.includes('version')) {
      status.version = this.version;
    }
    
    return status;
  }
  
  public writeStatus(): void {
    try {
      const status = this.generateStatus();
      
      // Ensure directory exists
      const dir = dirname(this.config.outputPath);
      mkdirSync(dir, { recursive: true });
      
      // Write status to file
      writeFileSync(
        this.config.outputPath,
        JSON.stringify(status, null, 2),
        'utf-8'
      );
      
      this.log('debug', `Status written to ${this.config.outputPath}`);
    } catch (error) {
      this.log('error', 'Failed to write status:', error);
      // Don't throw - continue running even if write fails
    }
  }
}