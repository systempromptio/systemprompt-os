/**
 * @fileoverview Repository for monitor module database operations
 * @module modules/core/monitor/repositories
 */

import type {
  MetricData,
  Alert,
  AlertConfig,
  Trace,
  MetricQuery,
  MetricDataPoint,
} from '../types/monitor.types.js';

export class MonitorRepository {
  constructor(private readonly db: any) {}

  // Metrics operations
  async recordMetric(metric: MetricData): Promise<void> {
    const labelsJson = JSON.stringify(metric.labels || {});

    await this.db.execute(`
      INSERT INTO metrics (id, name, type, value, labels, timestamp, unit, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      metric.id,
      metric.name,
      metric.type,
      metric.value,
      labelsJson,
      metric.timestamp.toISOString(),
      metric.unit || null,
      metric.description || null,
    ]);
  }

  async getMetrics(query: MetricQuery): Promise<MetricDataPoint[]> {
    let sql = `
      SELECT timestamp, value
      FROM metrics
      WHERE name = ?
    `;
    const params: any[] = [query.metric];

    if (query.start_time) {
      sql += ' AND timestamp >= ?';
      params.push(query.start_time.toISOString());
    }

    if (query.end_time) {
      sql += ' AND timestamp <= ?';
      params.push(query.end_time.toISOString());
    }

    if (query.labels) {
      for (const [key, value] of Object.entries(query.labels)) {
        sql += ` AND json_extract(labels, '$.${key}') = ?`;
        params.push(value);
      }
    }

    sql += ' ORDER BY timestamp ASC';

    const result = await this.db.select(sql, params);

    return result.rows.map((row: any) => ({
      timestamp: new Date(row.timestamp),
      value: row.value,
    }));
  }

  async getMetricNames(): Promise<string[]> {
    const result = await this.db.select(`
      SELECT DISTINCT name FROM metrics ORDER BY name
    `);

    return result.rows.map((row: any) => row.name);
  }

  async deleteOldMetrics(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await this.db.execute(`
      DELETE FROM metrics WHERE timestamp < ?
    `, [cutoffDate.toISOString()]);
  }

  // Alert operations
  async createAlert(alert: Alert): Promise<void> {
    const conditionJson = JSON.stringify(alert.condition);
    const metadataJson = JSON.stringify(alert.metadata || {});

    await this.db.execute(`
      INSERT INTO alerts (
        id, name, severity, condition, status, message,
        created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      alert.id,
      alert.name,
      alert.severity,
      conditionJson,
      alert.status,
      alert.message,
      alert.created_at.toISOString(),
      alert.updated_at.toISOString(),
      metadataJson,
    ]);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    const result = await this.db.select(`
      SELECT * FROM alerts 
      WHERE status IN ('active', 'acknowledged')
      ORDER BY severity DESC, created_at DESC
    `);

    return result.rows.map((row: any) => ({
      ...row,
      condition: JSON.parse(row.condition),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
    }));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.db.execute(`
      UPDATE alerts 
      SET status = 'acknowledged',
          acknowledged_at = ?,
          acknowledged_by = ?,
          updated_at = ?
      WHERE id = ? AND status = 'active'
    `, [
      new Date().toISOString(),
      userId,
      new Date().toISOString(),
      alertId,
    ]);
  }

  async resolveAlert(alertId: string): Promise<void> {
    await this.db.execute(`
      UPDATE alerts 
      SET status = 'resolved',
          resolved_at = ?,
          updated_at = ?
      WHERE id = ? AND status IN ('active', 'acknowledged')
    `, [
      new Date().toISOString(),
      new Date().toISOString(),
      alertId,
    ]);
  }

  // Alert configuration operations
  async createAlertConfig(config: AlertConfig): Promise<void> {
    const conditionJson = JSON.stringify(config.condition);
    const channelsJson = JSON.stringify(config.channels);

    await this.db.execute(`
      INSERT INTO alert_configs (
        id, name, description, condition, severity,
        channels, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.id,
      config.name,
      config.description || null,
      conditionJson,
      config.severity,
      channelsJson,
      config.enabled ? 1 : 0,
      config.created_at.toISOString(),
      config.updated_at.toISOString(),
    ]);
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    const result = await this.db.select(`
      SELECT * FROM alert_configs ORDER BY name
    `);

    return result.rows.map((row: any) => ({
      ...row,
      condition: JSON.parse(row.condition),
      channels: JSON.parse(row.channels),
      enabled: row.enabled === 1,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.condition !== undefined) {
      fields.push('condition = ?');
      values.push(JSON.stringify(updates.condition));
    }

    if (updates.severity !== undefined) {
      fields.push('severity = ?');
      values.push(updates.severity);
    }

    if (updates.channels !== undefined) {
      fields.push('channels = ?');
      values.push(JSON.stringify(updates.channels));
    }

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await this.db.execute(`
      UPDATE alert_configs 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);
  }

  // Trace operations
  async recordTrace(trace: Trace): Promise<void> {
    const attributesJson = JSON.stringify(trace.attributes);
    const eventsJson = JSON.stringify(trace.events);
    const linksJson = JSON.stringify(trace.links);

    await this.db.execute(`
      INSERT INTO traces (
        id, trace_id, span_id, parent_span_id, operation_name,
        service_name, start_time, end_time, duration, status,
        attributes, events, links
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trace.id,
      trace.trace_id,
      trace.span_id,
      trace.parent_span_id || null,
      trace.operation_name,
      trace.service_name,
      trace.start_time.toISOString(),
      trace.end_time?.toISOString() || null,
      trace.duration || null,
      trace.status,
      attributesJson,
      eventsJson,
      linksJson,
    ]);
  }

  async getTraces(limit: number = 100): Promise<Trace[]> {
    const result = await this.db.select(`
      SELECT * FROM traces 
      ORDER BY start_time DESC 
      LIMIT ?
    `, [limit]);

    return result.rows.map((row: any) => ({
      ...row,
      attributes: JSON.parse(row.attributes),
      events: JSON.parse(row.events),
      links: JSON.parse(row.links),
      start_time: new Date(row.start_time),
      end_time: row.end_time ? new Date(row.end_time) : undefined,
    }));
  }

  async getTraceById(traceId: string): Promise<Trace[]> {
    const result = await this.db.select(`
      SELECT * FROM traces 
      WHERE trace_id = ?
      ORDER BY start_time ASC
    `, [traceId]);

    return result.rows.map((row: any) => ({
      ...row,
      attributes: JSON.parse(row.attributes),
      events: JSON.parse(row.events),
      links: JSON.parse(row.links),
      start_time: new Date(row.start_time),
      end_time: row.end_time ? new Date(row.end_time) : undefined,
    }));
  }

  async deleteOldTraces(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await this.db.execute(`
      DELETE FROM traces WHERE start_time < ?
    `, [cutoffDate.toISOString()]);
  }

  // Statistics
  async getMetricStats(): Promise<any> {
    const result = await this.db.select(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT name) as unique_metrics,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM metrics
    `);

    return result.rows[0];
  }

  async getAlertStats(): Promise<any> {
    const result = await this.db.select(`
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged,
        COUNT(CASE WHEN status = 'resolved' AND DATE(resolved_at) = DATE('now') THEN 1 END) as resolved_today
      FROM alerts
    `);

    return result.rows[0];
  }

  async getTraceStats(): Promise<any> {
    const result = await this.db.select(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        AVG(duration) as avg_duration
      FROM traces
      WHERE end_time IS NOT NULL
    `);

    return result.rows[0];
  }
}