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
   * Creates a new mock monitor repository.
   * @param _db - Database adapter instance (unused in mock implementation).
   */
  constructor(_db: unknown) {
  }

  /**
   * Records a metric data point.
   * @param data - Metric data to record.
   * @param _data
   */
  async recordMetric(_data: IMetricData): Promise<void> {
    await Promise.resolve();
  }

  /**
   * Retrieves metrics based on query criteria.
   * @param query - Query parameters for filtering metrics.
   * @param _query
   * @returns Array of metric data.
   */
  async getMetrics(_query: IMetricQuery): Promise<IMetricData[]> {
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
   * @param _retentionDays
   */
  async deleteOldMetrics(_retentionDays: number): Promise<void> {
    await Promise.resolve();
  }
}
