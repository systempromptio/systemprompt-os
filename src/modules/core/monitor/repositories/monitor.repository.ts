/**
 * Monitor repository implementation.
 * @file Monitor repository for metric data storage and retrieval.
 * @module modules/core/monitor/repositories
 */

import type {
  IMetricData,
  IMetricLabelRow,
  IMetricQuery,
  IMetricRow,
  MonitorRepository
} from '@/modules/core/monitor/types';
import type { IDatabaseAdapter } from '@/modules/core/database/types';

/**
 * Repository implementation for monitor data using SQLite.
 */
export class MonitorRepositoryImpl implements MonitorRepository {
  constructor(private readonly db: IDatabaseAdapter) {}

  /**
   * Records a metric data point.
   * @param data - Metric data to record.
   */
  async recordMetric(data: IMetricData): Promise<void> {
    await this.db.execute('BEGIN TRANSACTION');

    try {
      const result = await this.db.execute(
        `INSERT INTO metric (name, value, type, unit, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.name,
          data.value,
          data.type,
          data.unit || null,
          data.timestamp.toISOString()
        ]
      );

      const metricId = result.lastInsertRowid;

      if (data.labels && Object.keys(data.labels).length > 0) {
        for (const [key, value] of Object.entries(data.labels)) {
          await this.db.execute(
            `INSERT INTO metric_label (metric_id, label_key, label_value) 
             VALUES (?, ?, ?)`,
            [metricId, key, value]
          );
        }
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * Retrieves metrics based on query criteria.
   * @param query - Query parameters for filtering metrics.
   * @returns Array of metric data.
   */
  async getMetrics(query: IMetricQuery): Promise<IMetricData[]> {
    let sql = `
      SELECT m.id, m.name, m.value, m.type, m.unit, m.timestamp
      FROM metric m
      WHERE m.name = ?
    `;
    const params: unknown[] = [query.metric];

    if (query.start_time) {
      sql += ' AND m.timestamp >= ?';
      params.push(query.start_time.toISOString());
    }

    if (query.end_time) {
      sql += ' AND m.timestamp <= ?';
      params.push(query.end_time.toISOString());
    }

    if (query.labels && Object.keys(query.labels).length > 0) {
      const labelEntries = Object.entries(query.labels);
      sql += ` AND m.id IN (
        SELECT metric_id FROM metric_label
        WHERE ${labelEntries.map(() => { return '(label_key = ? AND label_value = ?)' }).join(' OR ')}
        GROUP BY metric_id
        HAVING COUNT(DISTINCT label_key) = ?
      )`;

      for (const [key, value] of labelEntries) {
        params.push(key, value);
      }
      params.push(labelEntries.length);
    }

    sql += ' ORDER BY m.timestamp DESC';

    const rows = await this.db.query<IMetricRow>(sql, params);

    const metrics: IMetricData[] = [];
    for (const row of rows) {
      const labelRows = await this.db.query<IMetricLabelRow>(
        'SELECT label_key, label_value FROM metric_label WHERE metric_id = ?',
        [row.id]
      );

      const labels: Record<string, string> = {};
      for (const labelRow of labelRows) {
        labels[labelRow.label_key] = labelRow.label_value;
      }

      metrics.push({
        name: row.name,
        value: row.value,
        type: row.type,
        timestamp: new Date(row.timestamp),
        ...row.unit && { unit: row.unit },
        ...Object.keys(labels).length > 0 && { labels },
      });
    }

    return metrics;
  }

  /**
   * Gets all available metric names.
   * @returns Array of metric names.
   */
  async getMetricNames(): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(
      'SELECT DISTINCT name FROM metric ORDER BY name'
    );
    return rows.map(row => { return row.name });
  }

  /**
   * Deletes metrics older than retention period.
   * @param retentionDays - Number of days to retain metrics.
   */
  async deleteOldMetrics(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await this.db.execute(
      'DELETE FROM metric WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );
  }
}
