/**
 * @file Metric service for collecting, buffering, and managing application metrics.
 * @module modules/core/monitor/services
 * @description This service provides functionality for recording various metric types, querying historical data,
 * and managing system metrics collection.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import {
  type IMetricData,
  type IMetricQuery,
  type IMetricQueryResult,
  type MonitorRepository
} from '@/modules/core/monitor/repositories/monitor-repository';

import type {
  ILogger,
  IMetricConfig,
  ISystemMetrics,
  MetricType
} from '@/modules/core/monitor/types';

/**
 * Metric service for collecting, buffering, and managing application metrics.
 * Provides functionality for recording various metric types, querying historical data,
 * and managing system metrics collection.
 */
export class MetricService extends EventEmitter {
  private readonly repository: MonitorRepository;
  private readonly logger: ILogger;
  private readonly config: IMetricConfig;
  private buffer: IMetricData[] = [];
  private flushTimer?: NodeJS.Timeout;

  /**
   * Creates a new instance of MetricService.
   * @param repository - The repository for storing metrics.
   * @param logger - The logger instance.
   * @param config - The configuration for the metric service.
   */
  constructor(repository: MonitorRepository, logger: ILogger, config: IMetricConfig) {
    super();
    this.repository = repository;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Initialize the metric service and start periodic flushing.
   */
  initialize(): void {
    this.logger.info('Metric service initialized');

    this.flushTimer = setInterval(
      () => {
        void this.flushMetrics();
      },
      this.config.metrics.flushInterval
    );
  }

  /**
   * Record a metric with optional labels and unit.
   * @param name - The name of the metric.
   * @param value - The numeric value to record.
   * @param type - The type of metric (counter, gauge, or histogram).
   * @param labels - Optional key-value pairs for metric labels.
   * @param unit - Optional unit of measurement.
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricType = 'gauge',
    labels: Record<string, string> = {},
    unit?: string
  ): void {
    const metricData: IMetricData = {
      timestamp: new Date(),
      value
    };

    if (name) { metricData.name = name; }
    if (type) { metricData.type = type; }
    if (labels && Object.keys(labels).length > 0) { metricData.labels = labels; }
    if (unit) { metricData.unit = unit; }

    this.buffer.push(metricData);

    this.emit('metric:recorded', metricData);

    if (this.buffer.length >= this.config.metrics.bufferSize) {
      this.flushMetrics().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to auto-flush metrics', { error: errorMessage });
      });
    }
  }

  /**
   * Increment a counter metric.
   * @param name - The name of the counter metric.
   * @param labels - Optional key-value pairs for metric labels.
   * @param value - The amount to increment by (default: 1).
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.recordMetric(name, value, 'counter', labels);
  }

  /**
   * Set a gauge metric value.
   * @param name - The name of the gauge metric.
   * @param value - The numeric value to set.
   * @param labels - Optional key-value pairs for metric labels.
   * @param unit - Optional unit of measurement.
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}, unit?: string): void {
    this.recordMetric(name, value, 'gauge', labels, unit);
  }

  /**
   * Record a histogram metric.
   * @param name - The name of the histogram metric.
   * @param value - The numeric value to record.
   * @param labels - Optional key-value pairs for metric labels.
   * @param unit - Optional unit of measurement.
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}, unit?: string): void {
    this.recordMetric(name, value, 'histogram', labels, unit);
  }

  /**
   * Query metrics from the repository.
   * @param query - The query parameters for retrieving metrics.
   */
  async queryMetrics(query: IMetricQuery): Promise<IMetricQueryResult> {
    const data = await this.repository.getMetrics(query);
    return {
      metric: query.metric,
      data,
      labels: query.labels ?? {}
    };
  }

  /**
   * Get all available metric names.
   * @returns A promise that resolves to an array of metric names.
   */
  async getMetricNames(): Promise<string[]> {
    return await this.repository.getMetricNames();
  }

  /**
   * Get current system metrics.
   * @returns A promise that resolves to the current system metrics.
   */
  async getSystemMetrics(): Promise<ISystemMetrics> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      cpu: {
        cores: os.cpus().length
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory
      },
      disk: {},
      network: {},
      uptime: process.uptime()
    };
  }

  /**
   * Clean up old metrics beyond retention period.
   * @param retentionDays - The number of days to retain metrics.
   */
  async cleanupOldMetrics(retentionDays: number): Promise<void> {
    try {
      await this.repository.deleteOldMetrics(retentionDays);
      this.logger.info('Cleaned up old metrics', { retentionDays });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to cleanup old metrics', {
        error: errorMessage,
        retentionDays
      });
      throw error;
    }
  }

  /**
   * Shutdown the metric service, flush remaining metrics and clear timers.
   * @returns A promise that resolves when shutdown is complete.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      delete this.flushTimer;
    }

    await this.flushMetrics();
  }

  /**
   * Flush buffered metrics to the repository.
   * @returns A promise that resolves when all metrics are flushed.
   */
  private async flushMetrics(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      for (const metric of metricsToFlush) {
        await this.repository.recordMetric(metric);
      }

      this.emit('metrics:flushed', metricsToFlush.length);
    } catch (error: unknown) {
      this.buffer.unshift(...metricsToFlush);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to flush metrics', {
        error: errorMessage,
        count: metricsToFlush.length
      });
      throw error;
    }
  }
}
