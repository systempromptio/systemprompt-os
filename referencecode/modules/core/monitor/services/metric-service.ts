/**
 * @fileoverview Metric collection and management service
 * @module modules/core/monitor/services
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { MonitorRepository } from '../repositories/monitor-repository.js';
import type {
  MetricData,
  MetricQuery,
  MetricResult,
  SystemMetrics,
} from '../types/monitor.types.js';
import * as os from 'os';

export class MetricService extends EventEmitter {
  private metricsBuffer: MetricData[] = [];
  private flushInterval?: NodeJS.Timeout;
  private systemMetricsInterval?: NodeJS.Timeout;

  constructor(
    private readonly repository: MonitorRepository,
    private readonly logger: any,
    private readonly config: any,
  ) {
    super();
  }

  async initialize(): Promise<void> {
    // Start metric flush interval
    const flushIntervalMs = this.config?.(metrics?.flushInterval ?? 10000); // 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch((error) => {
        this.logger?.error('Failed to flush metrics', { error });
      });
    }, flushIntervalMs);

    // Start system metrics collection
    if (this.config?.metrics?.collectSystem !== false) {
      const systemInterval = this.config?.(metrics?.systemInterval ?? 60000); // 1 minute
      this.systemMetricsInterval = setInterval(() => {
        this.collectSystemMetrics().catch((error) => {
          this.logger?.error('Failed to collect system metrics', { error });
        });
      }, systemInterval);

      // Collect initial system metrics
      await this.collectSystemMetrics();
    }

    this.logger?.info('Metric service initialized');
  }

  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = undefined;
    }

    // Flush remaining metrics
    await this.flushMetrics();
  }

  // Record a metric
  recordMetric(
    name: string,
    value: number,
    type: MetricData['type'] = 'gauge',
    labels: Record<string, string> = {},
    unit?: string,
  ): void {
    const metric: MetricData = {
      id: randomUUID(),
      name,
      type,
      value,
      labels,
      timestamp: new Date(),
      unit,
    };

    this.metricsBuffer.push(metric);
    this.emit('metric:recorded', metric);

    // Auto-flush if buffer is too large
    if (this.metricsBuffer.length >= this.config?.(metrics?.bufferSize ?? 1000)) {
      this.flushMetrics().catch((error) => {
        this.logger?.error('Failed to auto-flush metrics', { error });
      });
    }
  }

  // Counter convenience method
  incrementCounter(name: string, labels: Record<string, string> = {}, increment: number = 1): void {
    this.recordMetric(name, increment, 'counter', labels);
  }

  // Gauge convenience method
  setGauge(name: string, value: number, labels: Record<string, string> = {}, unit?: string): void {
    this.recordMetric(name, value, 'gauge', labels, unit);
  }

  // Histogram convenience method
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    unit?: string,
  ): void {
    this.recordMetric(name, value, 'histogram', labels, unit);
  }

  // Query metrics
  async queryMetrics(query: MetricQuery): Promise<MetricResult> {
    const data = await this.repository.getMetrics(query);

    return {
      metric: query.metric,
      data,
      labels: query.labels || {},
    };
  }

  // Get available metric names
  async getMetricNames(): Promise<string[]> {
    return this.repository.getMetricNames();
  }

  // Get current system metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();
    const uptime = os.uptime();

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - ~~((100 * totalIdle) / totalTick);

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        load_average: loadAvg,
      },
      memory: {
        total: totalMem,
        used: totalMem - freeMem,
        free: freeMem,
        percentage: ((totalMem - freeMem) / totalMem) * 100,
      },
      disk: {
        // Note: Node.js doesn't provide built-in disk stats
        // This would need platform-specific implementation
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
      },
      network: {
        // Note: Node.js doesn't provide built-in network stats
        // This would need platform-specific implementation
        rx_bytes: 0,
        tx_bytes: 0,
        rx_packets: 0,
        tx_packets: 0,
      },
      uptime,
    };
  }

  // Private methods
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Record metrics in batches
      const batchSize = this.config?.metrics?.batchSize ?? 100;
      for (let i = 0; i < metrics.length; i += batchSize) {
        const batch = metrics.slice(i, i + batchSize);
        await Promise.all(batch.map(async (metric) => this.repository.recordMetric(metric)));
      }

      this.logger?.debug('Flushed metrics', { count: metrics.length });
      this.emit('metrics:flushed', metrics.length);
    } catch (error) {
      this.logger?.error('Failed to flush metrics', { error });
      // Put metrics back in buffer for retry
      this.metricsBuffer.unshift(...metrics);
      throw error;
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();

      // Record system metrics
      this.setGauge('system.cpu.usage', metrics.cpu.usage, {}, '%');
      this.setGauge('system.cpu.cores', metrics.cpu.cores);
      this.setGauge('system.cpu.load_1m', metrics.cpu.load_average[0]);
      this.setGauge('system.cpu.load_5m', metrics.cpu.load_average[1]);
      this.setGauge('system.cpu.load_15m', metrics.cpu.load_average[2]);

      this.setGauge('system.memory.total', metrics.memory.total, {}, 'bytes');
      this.setGauge('system.memory.used', metrics.memory.used, {}, 'bytes');
      this.setGauge('system.memory.free', metrics.memory.free, {}, 'bytes');
      this.setGauge('system.memory.usage', metrics.memory.percentage, {}, '%');

      this.setGauge('system.uptime', metrics.uptime, {}, 'seconds');

      this.logger?.debug('Collected system metrics');
    } catch (error) {
      this.logger?.error('Failed to collect system metrics', { error });
    }
  }

  // Cleanup old metrics
  async cleanupOldMetrics(retentionDays: number): Promise<void> {
    try {
      await this.repository.deleteOldMetrics(retentionDays);
      this.logger?.info('Cleaned up old metrics', { retentionDays });
    } catch (error) {
      this.logger?.error('Failed to cleanup old metrics', { error });
      throw error;
    }
  }
}
