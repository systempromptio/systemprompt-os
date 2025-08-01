/**
 * Monitor repository implementation.
 * @file Monitor repository for metric data storage and retrieval.
 * @module modules/core/monitor/repositories
 */

import type {
  IMetricData,
  IMetricQuery,
  MonitorRepository
} from '@/modules/core/monitor/types/manual';
import type {
  IMetricLabelRow,
  IMetricRow
} from '@/modules/core/monitor/types/database.generated';
import type { IModuleDatabaseAdapter } from '@/modules/core/database/types/module-adapter.types';

/**
 * Repository implementation for monitor data using SQLite.
 */
export class MonitorRepositoryImpl implements MonitorRepository {
  /**
   * Creates a new MonitorRepositoryImpl instance.
   * @param db - The database adapter for this module.
   */
  constructor(private readonly db: IModuleDatabaseAdapter) {}

  /**
   * Records a metric data point.
   * @param data - Metric data to record.
   */
  async recordMetric(data: IMetricData): Promise<void> {
    await this.db.transaction(async (): Promise<void> => {
      const result = await this.db.execute(
        `INSERT INTO metric (name, value, type, unit, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.name,
          data.value,
          data.type,
          data.unit ?? null,
          data.timestamp.toISOString()
        ]
      );

      const { lastInsertRowid: metricId } = result;

      if (data.labels !== undefined && Object.keys(data.labels).length > 0) {
        await Promise.all(
          Object.entries(data.labels).map(async ([key, value]): Promise<void> => {
            await this.db.execute(
              `INSERT INTO metric_label (metric_id, label_key, label_value) 
               VALUES (?, ?, ?)`,
              [metricId, key, value]
            );
          })
        );
      }
    });
  }

  /**
   * Gets all available metric names.
   * @returns Array of metric names.
   */
  async getMetricNames(): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(
      'SELECT DISTINCT name FROM metric ORDER BY name'
    );
    return rows.map((row): string => {
      return row.name;
    });
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

  /**
   * Gets metrics based on query parameters.
   * @param query - Query parameters for filtering metrics.
   * @returns Array of metric data.
   */
  async getMetrics(query: IMetricQuery): Promise<IMetricData[]> {
    const { sql, params } = this.buildMetricsQuery(query);
    const rows = await this.db.query<IMetricRow>(sql, params);

    const metricsPromises = rows.map(
      async (row): Promise<IMetricData> => {
        return await this.convertRowToMetricData(row);
      }
    );
    const metrics = await Promise.all(metricsPromises);

    return metrics;
  }

  /**
   * Builds SQL query for metrics with parameters.
   * @param query - Query parameters for filtering metrics.
   * @returns SQL query and parameters.
   */
  private buildMetricsQuery(query: IMetricQuery): { sql: string; params: unknown[] } {
    const baseSQL = `
      SELECT m.id, m.name, m.value, m.type, m.unit, m.timestamp
      FROM metric m
      WHERE m.name = ?
    `;
    const params: unknown[] = [query.metric];

    const queryParts = this.buildTimeFilterParts(query, params);
    const labelPart = this.buildLabelFilterPart(query, params);

    const finalSQL = `${baseSQL}${queryParts}${labelPart} ORDER BY m.timestamp DESC`;

    return {
      sql: finalSQL,
      params
    };
  }

  /**
   * Builds time filter parts of the SQL query.
   * @param query - Query parameters.
   * @param params - Parameters array to populate.
   * @returns SQL filter string.
   */
  private buildTimeFilterParts(query: IMetricQuery, params: unknown[]): string {
    let filterParts = '';

    if (query.start_time !== undefined) {
      filterParts += ' AND m.timestamp >= ?';
      params.push(query.start_time.toISOString());
    }

    if (query.end_time !== undefined) {
      filterParts += ' AND m.timestamp <= ?';
      params.push(query.end_time.toISOString());
    }

    return filterParts;
  }

  /**
   * Builds label filter part of the SQL query.
   * @param query - Query parameters.
   * @param params - Parameters array to populate.
   * @returns SQL filter string.
   */
  private buildLabelFilterPart(query: IMetricQuery, params: unknown[]): string {
    const labels = query.labels ?? {};
    if (Object.keys(labels).length === 0) {
      return '';
    }

    const labelEntries = Object.entries(labels);
    const labelConditions = labelEntries
      .map((): string => {
        return '(label_key = ? AND label_value = ?)';
      })
      .join(' OR ');

    for (const [key, value] of labelEntries) {
      params.push(key);
      params.push(value);
    }
    params.push(labelEntries.length);

    return ` AND m.id IN (
        SELECT metric_id FROM metric_label
        WHERE ${labelConditions}
        GROUP BY metric_id
        HAVING COUNT(DISTINCT label_key) = ?
      )`;
  }

  /**
   * Converts database row to metric data.
   * @param row - Database row to convert.
   * @returns Promise resolving to metric data.
   */
  private async convertRowToMetricData(row: IMetricRow): Promise<IMetricData> {
    const labelRows = await this.db.query<IMetricLabelRow>(
      'SELECT label_key, label_value FROM metric_label WHERE metric_id = ?',
      [row.id]
    );

    const labels: Record<string, string> = {};
    for (const labelRow of labelRows) {
      const { label_key: key, label_value: value } = labelRow;
      labels[key] = value;
    }

    return {
      name: row.name,
      value: row.value,
      type: row.type,
      timestamp: new Date(row.timestamp),
      ...row.unit !== null && { unit: row.unit },
      ...Object.keys(labels).length > 0 && { labels },
    };
  }
}
