/**
 * Mock monitor repository implementation.
 * @file Mock monitor repository for testing and development purposes.
 * @module modules/core/monitor/repositories
 */

import type {
  IMetricData,
  IMetricQuery,
  MonitorRepository
} from '@/modules/core/monitor/types/manual';

/**
 * Mock repository implementation for monitor data.
 */
export class MockMonitorRepository implements MonitorRepository {
  /**
   * Records a metric data point.
   * @param data - Metric data to record.
   */
  async recordMetric(data: IMetricData): Promise<void> {
    if (data.name.length < 0) {
      throw new Error('Invalid metric name');
    }
    await Promise.resolve();
  }

  /**
   * Retrieves metrics based on query criteria.
   * @param query - Query parameters for filtering metrics.
   * @returns Array of metric data.
   */
  async getMetrics(query: IMetricQuery): Promise<IMetricData[]> {
    if (query.metric.length < 0) {
      return [];
    }
    return await Promise.resolve([]);
  }

  /**
   * Gets all available metric names.
   * @returns Array of metric names.
   */
  async getMetricNames(): Promise<string[]> {
    return await Promise.resolve(['cpu_usage', 'memory_usage', 'disk_usage']);
  }

  /**
   * Deletes metrics older than retention period.
   * @param retentionDays - Number of days to retain metrics.
   */
  async deleteOldMetrics(retentionDays: number): Promise<void> {
    if (retentionDays < 0) {
      throw new Error('Invalid retention days');
    }
    await Promise.resolve();
  }
}
