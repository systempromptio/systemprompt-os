/**
 * System health check service
 */

import os from 'os';
import { existsSync } from 'fs';
import type { HealthCheck, HealthReport } from '../types/index.js';

export class HealthService {
  private checks: Map<string, () => Promise<HealthCheck>>;
  
  constructor(private config: any, private readonly logger?: any) {
    this.checks = new Map();
    this.registerDefaultChecks();
    this.logger?.info('Health service initialized');
  }
  
  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    const enabledChecks = this.config.checks || ['memory', 'cpu', 'disk', 'modules'];
    
    if (enabledChecks.includes('memory')) {
      this.checks.set('memory', () => this.checkMemory());
    }
    
    if (enabledChecks.includes('cpu')) {
      this.checks.set('cpu', () => this.checkCPU());
    }
    
    if (enabledChecks.includes('disk')) {
      this.checks.set('disk', () => this.checkDisk());
    }
    
    if (enabledChecks.includes('modules')) {
      this.checks.set('modules', () => this.checkModules());
    }
  }
  
  /**
   * Run all health checks
   */
  async runHealthCheck(): Promise<HealthReport> {
    const checks: HealthCheck[] = [];
    
    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        checks.push(result);
      } catch (error) {
        checks.push({
          name,
          status: 'fail',
          message: `Check failed: ${error}`
        });
      }
    }
    
    // Determine overall health
    const hasFailure = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warn');
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailure) {
      overall = 'unhealthy';
    } else if (hasWarning) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }
    
    return {
      overall,
      checks,
      timestamp: new Date()
    };
  }
  
  /**
   * Check memory health
   */
  private async checkMemory(): Promise<HealthCheck> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = used / total;
    
    const threshold = this.config.thresholds?.memory || 0.9;
    
    if (usagePercent > threshold) {
      return {
        name: 'memory',
        status: 'warn',
        message: `Memory usage is ${(usagePercent * 100).toFixed(1)}% (threshold: ${(threshold * 100)}%)`,
        details: {
          total,
          free,
          used,
          usagePercent
        }
      };
    }
    
    return {
      name: 'memory',
      status: 'pass',
      message: `Memory usage is ${(usagePercent * 100).toFixed(1)}%`,
      details: {
        total,
        free,
        used,
        usagePercent
      }
    };
  }
  
  /**
   * Check CPU health
   */
  private async checkCPU(): Promise<HealthCheck> {
    const loadAverage = os.loadavg();
    const cores = os.cpus().length;
    const normalizedLoad = loadAverage[0] / cores;
    
    const threshold = this.config.thresholds?.cpu || 0.8;
    
    if (normalizedLoad > threshold) {
      return {
        name: 'cpu',
        status: 'warn',
        message: `CPU load is ${(normalizedLoad * 100).toFixed(1)}% (threshold: ${(threshold * 100)}%)`,
        details: {
          loadAverage,
          cores,
          normalizedLoad
        }
      };
    }
    
    return {
      name: 'cpu',
      status: 'pass',
      message: `CPU load is ${(normalizedLoad * 100).toFixed(1)}%`,
      details: {
        loadAverage,
        cores,
        normalizedLoad
      }
    };
  }
  
  /**
   * Check disk health
   */
  private async checkDisk(): Promise<HealthCheck> {
    // Check state directory
    const stateDir = './state';
    
    if (!existsSync(stateDir)) {
      return {
        name: 'disk',
        status: 'fail',
        message: 'State directory does not exist'
      };
    }
    
    try {
      // Check if we can write to state directory
      const testFile = `${stateDir}/.health-check-${Date.now()}`;
      require('fs').writeFileSync(testFile, 'test');
      require('fs').unlinkSync(testFile);
      
      return {
        name: 'disk',
        status: 'pass',
        message: 'Disk is accessible and writable'
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'fail',
        message: `Disk write test failed: ${error}`
      };
    }
  }
  
  /**
   * Check module health
   */
  private async checkModules(): Promise<HealthCheck> {
    // TODO: Check actual module health from registry
    // For now, just check if critical directories exist
    const criticalPaths = [
      './src/modules/core/logger',
      './src/modules/core/database',
      './src/modules/core/auth'
    ];
    
    const missing = criticalPaths.filter(path => !existsSync(path));
    
    if (missing.length > 0) {
      return {
        name: 'modules',
        status: 'fail',
        message: `Missing critical modules: ${missing.join(', ')}`,
        details: { missing }
      };
    }
    
    return {
      name: 'modules',
      status: 'pass',
      message: 'All critical modules are present'
    };
  }
  
  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }
  
  /**
   * Remove a health check
   */
  removeCheck(name: string): void {
    this.checks.delete(name);
  }
}