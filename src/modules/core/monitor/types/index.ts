/**
 * @file Monitor module types.
 * @module modules/core/monitor/types
 * @description Types and interfaces for the monitor module.
 */

export type * from '@/modules/core/monitor/repositories/monitor-repository';

/**
 * Configuration for metric service.
 */
export interface IMetricConfig {
  metrics: {
    flushInterval: number;
    bufferSize: number;
    collectSystem: boolean;
  };
}

/**
 * Logger interface.
 */
export interface ILogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

/**
 * Metric types.
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * System metrics structure.
 */
export interface ISystemMetrics {
  cpu: {
    cores: number;
    usage?: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
  };
  disk: {
    total?: number;
    free?: number;
    used?: number;
  };
  network: {
    bytesIn?: number;
    bytesOut?: number;
  };
  uptime: number;
}

import type { MetricService } from '@/modules/core/monitor/services/metric.service';

export type { MetricService };

/**
 * Configuration for the monitor module.
 */
export interface MonitorModuleConfig {
  name: string;
  type: string;
  version: string;
  config: {
    metrics: {
      enabled: boolean;
      flushInterval: number;
      bufferSize?: number;
      collectSystem?: boolean;
    };
    alerts: {
      enabled: boolean;
      evaluationInterval: number;
    };
    traces: {
      enabled: boolean;
      sampling: number;
    };
    cleanup: {
      interval: number;
      retentionDays: number;
    };
  };
}

/**
 * Dependencies required by the monitor module.
 */
export interface MonitorModuleDependencies {
  logger: {
    info: (message: string) => void;
    error: (message: string, data?: unknown) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
  };
  database: {
    getAdapter: (name: string) => unknown;
  };
}

/**
 * Health check result structure.
 */
export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  checks?: {
    database: boolean;
    service: boolean;
    status: string;
  };
}

/**
 * Strongly typed exports interface for Monitor module.
 */
export interface IMonitorModuleExports {
  readonly MonitorService: MetricService;
}
