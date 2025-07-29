/**
 * Metric service for collecting, buffering, and managing application metrics.
 * This service provides functionality for recording various metric types,
 * querying historical data, and managing system metrics collection.
 * Implements singleton pattern for core module compliance.
 * @file Metric service for collecting, buffering, and managing application metrics.
 * @module modules/core/monitor/services
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import type {
  ILogger,
  IMetricConfig,
  IMetricData,
  IMetricQuery,
  IMetricQueryResult,
  ISystemMetrics,
  MonitorRepository
} from '@/modules/core/monitor/types';
import { MetricType } from '@/modules/core/monitor/types';

/**
 * Metric service for collecting, buffering, and managing application metrics.
 * Provides functionality for recording various metric types, querying historical data,
 * and managing system metrics collection.
 * Implements singleton pattern for core module compliance.
 */
export class MetricService extends EventEmitter {
  private static instance: MetricService | null = null;
  private repository: MonitorRepository;
  private logger: ILogger;
  private config: IMetricConfig;
  private buffer: IMetricData[] = [];
  private flushTimer?: NodeJS.Timeout;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super();
    this.repository = this.createDefaultRepository();
    this.logger = this.createDefaultLogger();
    this.config = this.createDefaultConfig();
  }

  /**
   * Gets the singleton instance of MetricService.
   * @returns The MetricService instance.
   */
  public static getInstance(): MetricService {
    MetricService.instance ??= new MetricService();
    return MetricService.instance;
  }

  /**
   * Initializes the service with dependencies.
   * @param repository - The repository for storing metrics.
   * @param logger - The logger instance.
   * @param config - The configuration for the metric service.
   */
  public setDependencies(
    repository: MonitorRepository,
    logger: ILogger,
    config: IMetricConfig
  ): void {
    this.repository = repository;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Initialize the metric service and start periodic flushing.
   */
  public initialize(): void {
    this.logger.info('Metric service initialized');

    this.flushTimer = setInterval(
      (): void => {
        this.flushMetrics().catch((error: unknown): void => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error('Failed to flush metrics in timer', { error: errorMessage });
        });
      },
      this.config.metrics.flushInterval
    );
  }

  /**
   * Record a metric with optional labels and unit.
   * @param options - The metric recording options.
   * @param options.name - The name of the metric.
   * @param options.value - The numeric value to record.
   * @param options.type - The type of metric (counter, gauge, or histogram).
   * @param options.labels - Optional key-value pairs for metric labels.
   * @param options.unit - Optional unit of measurement.
   */
  public recordMetric(options: {
    name: string;
    value: number;
    type?: MetricType;
    labels?: Record<string, string>;
    unit?: string;
  }): void {
    const {
      name,
      value,
      type = MetricType.GAUGE,
      labels = {},
      unit
    } = options;

    const metricData: IMetricData = {
      timestamp: new Date(),
      value,
      name,
      type,
      labels,
      ...unit !== undefined && { unit }
    };

    this.buffer.push(metricData);

    this.emit('metric:recorded', metricData);

    if (this.buffer.length >= this.config.metrics.bufferSize) {
      this.flushMetrics().catch((error: unknown): void => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to auto-flush metrics', { error: errorMessage });
      });
    }
  }

  /**
   * Increment a counter metric.
   * @param options - The counter increment options.
   * @param options.name - The name of the counter metric.
   * @param options.labels - Optional key-value pairs for metric labels.
   * @param options.value - The amount to increment by (default: 1).
   */
  public incrementCounter(options: {
    name: string;
    labels?: Record<string, string>;
    value?: number;
  }): void {
    const {
      name,
      labels = {},
      value = 1
    } = options;
    this.recordMetric({
      name,
      value,
      type: MetricType.COUNTER,
      labels
    });
  }

  /**
   * Set a gauge metric value.
   * @param options - The gauge setting options.
   * @param options.name - The name of the gauge metric.
   * @param options.value - The numeric value to set.
   * @param options.labels - Optional key-value pairs for metric labels.
   * @param options.unit - Optional unit of measurement.
   */
  public setGauge(options: {
    name: string;
    value: number;
    labels?: Record<string, string>;
    unit?: string;
  }): void {
    const {
      name,
      value,
      labels = {},
      unit
    } = options;
    this.recordMetric({
      name,
      value,
      type: MetricType.GAUGE,
      labels,
      ...unit !== undefined && { unit }
    });
  }

  /**
   * Record a histogram metric.
   * @param options - The histogram recording options.
   * @param options.name - The name of the histogram metric.
   * @param options.value - The numeric value to record.
   * @param options.labels - Optional key-value pairs for metric labels.
   * @param options.unit - Optional unit of measurement.
   */
  public recordHistogram(options: {
    name: string;
    value: number;
    labels?: Record<string, string>;
    unit?: string;
  }): void {
    const {
      name,
      value,
      labels = {},
      unit
    } = options;
    this.recordMetric({
      name,
      value,
      type: MetricType.HISTOGRAM,
      labels,
      ...unit !== undefined && { unit }
    });
  }

  /**
   * Query metrics from the repository.
   * @param query - The query parameters for retrieving metrics.
   * @returns A promise that resolves to the query result.
   */
  public async queryMetrics(query: IMetricQuery): Promise<IMetricQueryResult> {
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
  public async getMetricNames(): Promise<string[]> {
    return await this.repository.getMetricNames();
  }

  /**
   * Get current system metrics.
   * @returns A promise that resolves to the current system metrics.
   */
  public async getSystemMetrics(): Promise<ISystemMetrics> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return await Promise.resolve({
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
    });
  }

  /**
   * Clean up old metrics beyond retention period.
   * @param retentionDays - The number of days to retain metrics.
   */
  public async cleanupOldMetrics(retentionDays: number): Promise<void> {
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
  public async shutdown(): Promise<void> {
    if (this.flushTimer !== undefined) {
      clearInterval(this.flushTimer);
      this.flushTimer = null as any;
    }

    await this.flushMetrics();
  }

  /**
   * Creates a default repository for initialization.
   * @returns A default monitor repository.
   */
  private createDefaultRepository(): MonitorRepository {
    return {
      recordMetric: async (): Promise<void> => {
        await Promise.resolve();
      },
      getMetrics: async (): Promise<IMetricData[]> => {
        return await Promise.resolve([]);
      },
      getMetricNames: async (): Promise<string[]> => {
        return await Promise.resolve([]);
      },
      deleteOldMetrics: async (): Promise<void> => {
        await Promise.resolve();
      }
    };
  }

  /**
   * Creates a default logger for initialization.
   * No-op logger implementation for default behavior.
   * @returns A default logger.
   */
  private createDefaultLogger(): ILogger {
    const noop = (): void => {
    };
    return {
      info: noop,
      error: noop,
      warn: noop,
      debug: noop
    };
  }

  /**
   * Creates a default config for initialization.
   * @returns A default metric config.
   */
  private createDefaultConfig(): IMetricConfig {
    return {
      metrics: {
        flushInterval: 30000,
        bufferSize: 100,
        collectSystem: false
      }
    };
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
      await Promise.all(
        metricsToFlush.map(
          async (metric): Promise<void> => {
            await this.repository.recordMetric(metric);
          }
        )
      );

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
