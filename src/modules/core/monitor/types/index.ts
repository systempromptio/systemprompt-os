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

export * from '@/modules/core/monitor/services/metric.service';
