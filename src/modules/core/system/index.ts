/**
 * @fileoverview System module - Core system management and monitoring
 * @module modules/core/system
 */

import { existsSync, mkdirSync } from 'fs';
import type { ModuleInterface } from '../../types.js';
import { SystemService } from './services/system.service.js';
import { HealthService } from './services/health.service.js';
import { MetricsService } from './services/metrics.service.js';
import { BackupService } from './services/backup.service.js';
import type { SystemStatus, HealthReport, SystemMetric, BackupInfo } from './types/index.js';

export class SystemModule implements ModuleInterface {
  name = 'system';
  version = '1.0.0';
  type = 'daemon' as const;
  
  private config: any;
  private logger: any;
  private systemService!: SystemService;
  private healthService!: HealthService;
  private metricsService!: MetricsService;
  private backupService!: BackupService;
  private monitoringInterval?: NodeJS.Timeout;
  
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    
    // Ensure state directories exist
    const stateDir = './state';
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    
    if (this.config.backup?.enabled) {
      const backupPath = this.config.backup.path || './backups';
      if (!existsSync(backupPath)) {
        mkdirSync(backupPath, { recursive: true });
      }
    }
    
    // Initialize services
    this.systemService = new SystemService(this.logger);
    this.healthService = new HealthService(this.config.health || {}, this.logger);
    this.metricsService = new MetricsService(this.config.monitoring || {}, this.logger);
    this.backupService = new BackupService(this.config.backup || {}, this.logger);
    
    this.logger?.info('System module initialized');
  }
  
  async start(): Promise<void> {
    // Start monitoring if enabled
    if (this.config.monitoring?.enabled !== false) {
      const interval = this.config.monitoring?.interval || 60000;
      this.startMonitoring(interval);
    }
    
    this.logger?.info('System module started');
  }
  
  async stop(): Promise<void> {
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // Flush any pending metrics
    await this.metricsService.flush();
    
    this.logger?.info('System module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const report = await this.healthService.runHealthCheck();
      return {
        healthy: report.overall === 'healthy',
        message: `System is ${report.overall}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error}`
      };
    }
  }
  
  /**
   * Start system monitoring
   */
  private startMonitoring(interval: number): void {
    // Run immediately
    this.collectMetrics();
    
    // Then run on interval
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);
  }
  
  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const status = await this.systemService.getStatus();
      
      // Record metrics
      await this.metricsService.record([
        {
          name: 'system.cpu.usage',
          value: status.cpu.usage,
          unit: 'percent',
          timestamp: new Date()
        },
        {
          name: 'system.memory.usage',
          value: status.memory.usagePercent,
          unit: 'percent',
          timestamp: new Date()
        },
        {
          name: 'system.disk.usage',
          value: status.disk.usagePercent,
          unit: 'percent',
          timestamp: new Date()
        },
        {
          name: 'system.uptime',
          value: status.uptime,
          unit: 'seconds',
          timestamp: new Date()
        }
      ]);
      
      // Check thresholds and emit warnings
      const thresholds = this.config.health?.thresholds || {};
      if (status.memory.usagePercent > (thresholds.memory || 0.9)) {
        this.logger?.warn('High memory usage', { usage: status.memory.usagePercent });
      }
      if (status.cpu.usage > (thresholds.cpu || 0.8)) {
        this.logger?.warn('High CPU usage', { usage: status.cpu.usage });
      }
      if (status.disk.usagePercent > (thresholds.disk || 0.85)) {
        this.logger?.warn('High disk usage', { usage: status.disk.usagePercent });
      }
    } catch (error) {
      this.logger?.error('Failed to collect metrics', error);
    }
  }
  
  // Public API methods
  
  async getSystemStatus(): Promise<SystemStatus> {
    return this.systemService.getStatus();
  }
  
  async getHealthReport(): Promise<HealthReport> {
    return this.healthService.runHealthCheck();
  }
  
  async getMetrics(period: string = '1h'): Promise<SystemMetric[]> {
    return this.metricsService.getMetrics(period);
  }
  
  async createBackup(options: any): Promise<BackupInfo> {
    return this.backupService.createBackup(options);
  }
  
  async restoreBackup(backupId: string, options: any): Promise<void> {
    return this.backupService.restoreBackup(backupId, options);
  }
  
  async getEvents(_filter?: any): Promise<any[]> {
    // TODO: Implement event streaming
    return [];
  }
}

// Export for dynamic loading
export default SystemModule;