/**
 * System module type definitions
 */

export interface SystemStatus {
  uptime: number;
  version: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  hostname: string;
  memory: MemoryInfo;
  cpu: CPUInfo;
  disk: DiskInfo;
  modules: ModuleStatus[];
  timestamp: Date;
}

export interface MemoryInfo {
  total: number;
  free: number;
  used: number;
  usagePercent: number;
}

export interface CPUInfo {
  model: string;
  cores: number;
  usage: number;
  loadAverage: number[];
}

export interface DiskInfo {
  total: number;
  free: number;
  used: number;
  usagePercent: number;
  path: string;
}

export interface ModuleStatus {
  name: string;
  version: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  healthy: boolean;
  message?: string;
  uptime?: number;
  memory?: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: Date;
}

export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface SystemEvent {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export interface BackupOptions {
  includeConfig: boolean;
  includeData: boolean;
  includeModules: boolean;
  compress: boolean;
}

export interface BackupInfo {
  id: string;
  timestamp: Date;
  version: string;
  components: string[];
  size: number;
  path: string;
  compressed: boolean;
}