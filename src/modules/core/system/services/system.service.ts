/**
 * System information and status service
 */

import os from 'os';
import { execSync } from 'child_process';
import type { SystemStatus, MemoryInfo, CPUInfo, DiskInfo, ModuleStatus } from '../types/index.js';

export class SystemService {
  constructor(private logger: any) {}
  
  /**
   * Get comprehensive system status
   */
  async getStatus(): Promise<SystemStatus> {
    const [memory, cpu, disk, modules] = await Promise.all([
      this.getMemoryInfo(),
      this.getCPUInfo(),
      this.getDiskInfo(),
      this.getModuleStatuses()
    ]);
    
    return {
      uptime: process.uptime(),
      version: this.getSystemVersion(),
      nodeVersion: process.version,
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      memory,
      cpu,
      disk,
      modules,
      timestamp: new Date()
    };
  }
  
  /**
   * Get memory information
   */
  private async getMemoryInfo(): Promise<MemoryInfo> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      total,
      free,
      used,
      usagePercent: (used / total) * 100
    };
  }
  
  /**
   * Get CPU information
   */
  private async getCPUInfo(): Promise<CPUInfo> {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage
    const usage = await this.calculateCPUUsage();
    
    return {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      usage,
      loadAverage
    };
  }
  
  /**
   * Calculate CPU usage percentage
   */
  private async calculateCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }
  
  /**
   * Get disk information
   */
  private async getDiskInfo(): Promise<DiskInfo> {
    try {
      let diskInfo: DiskInfo;
      
      if (os.platform() === 'win32') {
        // Windows
        const output = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8' });
        // Parse Windows output
        diskInfo = this.parseWindowsDiskInfo(output);
      } else {
        // Unix-like systems
        const output = execSync('df -k /', { encoding: 'utf8' });
        diskInfo = this.parseUnixDiskInfo(output);
      }
      
      return diskInfo;
    } catch (error) {
      this.logger?.error('Failed to get disk info', error);
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
        path: '/'
      };
    }
  }
  
  /**
   * Parse Unix df output
   */
  private parseUnixDiskInfo(output: string): DiskInfo {
    const lines = output.trim().split('\n');
    const data = lines[1].split(/\s+/);
    
    const total = parseInt(data[1]) * 1024; // Convert from KB to bytes
    const used = parseInt(data[2]) * 1024;
    const free = parseInt(data[3]) * 1024;
    const usagePercent = parseInt(data[4]);
    
    return {
      total,
      free,
      used,
      usagePercent,
      path: data[5] || '/'
    };
  }
  
  /**
   * Parse Windows disk info
   */
  private parseWindowsDiskInfo(output: string): DiskInfo {
    // Simple implementation - just get C: drive
    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.includes('C:')) {
        const parts = line.trim().split(/\s+/);
        const free = parseInt(parts[1]) || 0;
        const total = parseInt(parts[2]) || 0;
        const used = total - free;
        
        return {
          total,
          free,
          used,
          usagePercent: total > 0 ? (used / total) * 100 : 0,
          path: 'C:\\'
        };
      }
    }
    
    return {
      total: 0,
      free: 0,
      used: 0,
      usagePercent: 0,
      path: 'C:\\'
    };
  }
  
  /**
   * Get module statuses
   */
  private async getModuleStatuses(): Promise<ModuleStatus[]> {
    // TODO: Get actual module statuses from module registry
    // For now, return mock data
    return [
      {
        name: 'logger',
        version: '1.0.0',
        type: 'service',
        status: 'running',
        healthy: true,
        uptime: process.uptime()
      },
      {
        name: 'database',
        version: '1.0.0',
        type: 'service',
        status: 'running',
        healthy: true,
        uptime: process.uptime()
      },
      {
        name: 'system',
        version: '1.0.0',
        type: 'daemon',
        status: 'running',
        healthy: true,
        uptime: process.uptime()
      }
    ];
  }
  
  /**
   * Get system version from package.json
   */
  private getSystemVersion(): string {
    try {
      const packageJson = require('../../../../package.json');
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}