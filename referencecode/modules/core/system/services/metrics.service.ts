/**
 * System metrics collection and storage service
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { SystemMetric } from '../types/index.js';

export class MetricsService {
  private metrics: SystemMetric[] = [];
  private readonly metricsFile: string;
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory

  constructor(
    config: any,
    private readonly logger: any,
  ) {
    this.metricsFile = config.metricsFile || './state/system-metrics.json';
    this.loadMetrics();
  }

  /**
   * Load metrics from file
   */
  private loadMetrics(): void {
    try {
      if (existsSync(this.metricsFile)) {
        const data = readFileSync(this.metricsFile, 'utf-8');
        this.metrics = JSON.parse(data).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch (error) {
      this.logger?.error('Failed to load metrics', error);
      this.metrics = [];
    }
  }

  /**
   * Save metrics to file
   */
  private saveMetrics(): void {
    try {
      writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      this.logger?.error('Failed to save metrics', error);
    }
  }

  /**
   * Record metrics
   */
  async record(metrics: SystemMetric[]): Promise<void> {
    this.metrics.push(...metrics);

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Save periodically (every 10 records)
    if (this.metrics.length % 10 === 0) {
      this.saveMetrics();
    }
  }

  /**
   * Get metrics for a time period
   */
  async getMetrics(period: string = '1h'): Promise<SystemMetric[]> {
    const now = Date.now();
    let since: number;

    switch (period) {
      case '1h':
        since = now - 60 * 60 * 1000;
        break;
      case '24h':
        since = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        since = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        since = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        since = now - 60 * 60 * 1000; // Default to 1 hour
    }

    return this.metrics.filter((m) => m.timestamp.getTime() >= since);
  }

  /**
   * Get metrics by name
   */
  async getMetricsByName(name: string, period?: string): Promise<SystemMetric[]> {
    let metrics = this.metrics.filter((m) => m.name === name);

    if (period) {
      const allMetrics = await this.getMetrics(period);
      metrics = allMetrics.filter((m) => m.name === name);
    }

    return metrics;
  }

  /**
   * Get latest metric value
   */
  async getLatestMetric(name: string): Promise<SystemMetric | undefined> {
    const metrics = this.metrics.filter((m) => m.name === name);
    return metrics[metrics.length - 1];
  }

  /**
   * Calculate metric statistics
   */
  async getMetricStats(
    name: string,
    period: string = '1h',
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    count: number;
    last: number;
  }> {
    const metrics = await this.getMetricsByName(name, period);

    if (metrics.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, last: 0 };
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      count: values.length,
      last: values[values.length - 1],
    };
  }

  /**
   * Clear old metrics
   */
  async cleanupMetrics(olderThan: number): Promise<void> {
    const cutoff = Date.now() - olderThan;
    this.metrics = this.metrics.filter((m) => m.timestamp.getTime() >= cutoff);
    this.saveMetrics();
  }

  /**
   * Flush metrics to disk
   */
  async flush(): Promise<void> {
    this.saveMetrics();
  }
}
