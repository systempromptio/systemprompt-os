/**
 * @fileoverview Main monitoring service orchestrator
 * @module modules/core/monitor/services
 */

import { EventEmitter } from 'events';
import type { MonitorRepository } from '../repositories/monitor-repository.js';
import { MetricService } from './metric-service.js';
import { AlertService } from './alert-service.js';
import { TraceService } from './trace-service.js';
import type {
  MonitorStatus,
  MonitoringExport,
  Alert,
  AlertConfig,
  MetricQuery,
  MetricResult,
  Trace,
} from '../types/monitor.types.js';

export class MonitorService extends EventEmitter {
  private readonly metricService: MetricService;
  private readonly alertService: AlertService;
  private readonly traceService: TraceService;

  constructor(
    private readonly repository: MonitorRepository,
    private readonly logger: any,
    private readonly config: any,
  ) {
    super();

    // Initialize sub-services
    this.metricService = new MetricService(repository, logger, config);
    this.alertService = new AlertService(repository, this.metricService, logger, config);
    this.traceService = new TraceService(repository, logger, config);
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.metricService.initialize(),
      this.alertService.initialize(),
      this.traceService.initialize(),
    ]);

    // Forward events from sub-services
    this.metricService.on('metric:recorded', (metric) => this.emit('metric:recorded', metric));
    this.alertService.on('alert:created', (alert) => this.emit('alert:created', alert));
    this.alertService.on('alert:resolved', (alert) => this.emit('alert:resolved', alert));
    this.traceService.on('span:started', (trace) => this.emit('span:started', trace));
    this.traceService.on('span:ended', (trace) => this.emit('span:ended', trace));

    this.logger?.info('Monitor service initialized');
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.metricService.shutdown(),
      this.alertService.shutdown(),
      this.traceService.shutdown(),
    ]);
  }

  // Get overall monitoring status
  async getStatus(): Promise<MonitorStatus> {
    const [metricStats, alertStats, traceStats, systemMetrics] = await Promise.all([
      this.repository.getMetricStats(),
      this.repository.getAlertStats(),
      this.repository.getTraceStats(),
      this.metricService.getSystemMetrics(),
    ]);

    // Calculate metrics rate (per minute)
    const metricsRate = metricStats.total > 0 && metricStats.newest && metricStats.oldest
      ? (metricStats.total / ((new Date(metricStats.newest).getTime() - new Date(metricStats.oldest).getTime()) / 60000))
      : 0;

    // Calculate error rate for traces
    const errorRate = traceStats.total > 0
      ? (traceStats.errors / traceStats.total) * 100
      : 0;

    return {
      healthy: true,
      metrics: {
        total: metricStats.total,
        active: metricStats.unique_metrics,
        rate: Math.round(metricsRate * 100) / 100,
      },
      alerts: {
        active: alertStats.active,
        acknowledged: alertStats.acknowledged,
        resolved_today: alertStats.resolved_today,
      },
      traces: {
        total: traceStats.total,
        error_rate: Math.round(errorRate * 100) / 100,
        avg_duration: Math.round(traceStats.avg_duration || 0),
      },
      system: systemMetrics,
    };
  }

  // Export monitoring data
  async exportData(options: MonitoringExport): Promise<any> {
    const exportData: any = {
      exported_at: new Date().toISOString(),
      format: options.format,
    };

    // Export metrics
    if (options.metrics && options.metrics.length > 0) {
      exportData.metrics = {};
      for (const metricName of options.metrics) {
        const query: MetricQuery = {
          metric: metricName,
          start_time: options.start_date,
          end_time: options.end_date,
        };
        const result = await this.metricService.queryMetrics(query);
        exportData.metrics[metricName] = result.data;
      }
    }

    // Export alerts
    if (options.include_alerts) {
      exportData.alerts = await this.alertService.getActiveAlerts();
    }

    // Export traces
    if (options.include_traces) {
      exportData.traces = await this.traceService.getTraces(1000);
    }

    // Format based on export type
    switch (options.format) {
    case 'json':
      return exportData;

    case 'csv':
      return this.formatAsCSV(exportData);

    case 'prometheus':
      return this.formatAsPrometheus(exportData);

    default:
      return exportData;
    }
  }

  // Metric operations (delegated)
  recordMetric(name: string, value: number, type?: any, labels?: any, unit?: string): void {
    this.metricService.recordMetric(name, value, type, labels, unit);
  }

  incrementCounter(name: string, labels?: any, increment?: number): void {
    this.metricService.incrementCounter(name, labels, increment);
  }

  setGauge(name: string, value: number, labels?: any, unit?: string): void {
    this.metricService.setGauge(name, value, labels, unit);
  }

  recordHistogram(name: string, value: number, labels?: any, unit?: string): void {
    this.metricService.recordHistogram(name, value, labels, unit);
  }

  async queryMetrics(query: MetricQuery): Promise<MetricResult> {
    return this.metricService.queryMetrics(query);
  }

  async getMetricNames(): Promise<string[]> {
    return this.metricService.getMetricNames();
  }

  // Alert operations (delegated)
  async getActiveAlerts(): Promise<Alert[]> {
    return this.alertService.getActiveAlerts();
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    return this.alertService.acknowledgeAlert(alertId, userId);
  }

  async configureAlert(config: AlertConfig): Promise<void> {
    return this.alertService.configureAlert(config);
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    return this.alertService.getAlertConfigs();
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    return this.alertService.updateAlertConfig(id, updates);
  }

  // Trace operations (delegated)
  startSpan(operationName: string, options?: any): string {
    return this.traceService.startSpan(operationName, options);
  }

  async endSpan(spanId: string, status?: any, error?: Error): Promise<void> {
    return this.traceService.endSpan(spanId, status, error);
  }

  addEvent(spanId: string, name: string, attributes?: any): void {
    this.traceService.addEvent(spanId, name, attributes);
  }

  setAttributes(spanId: string, attributes: any): void {
    this.traceService.setAttributes(spanId, attributes);
  }

  async getTraces(limit?: number): Promise<Trace[]> {
    return this.traceService.getTraces(limit);
  }

  async getTrace(traceId: string): Promise<Trace[]> {
    return this.traceService.getTrace(traceId);
  }

  traced<T extends (...args: any[]) => any>(
    operationName: string,
    fn: T,
    options?: any,
  ): T {
    return this.traceService.traced(operationName, fn, options);
  }

  // Cleanup operations
  async runCleanup(): Promise<void> {
    {
      const retentionDays = this.config?.retention?.days || 30;
    }

    await Promise.all([
      this.metricService.cleanupOldMetrics(retentionDays),
      this.traceService.cleanupOldTraces(retentionDays),
    ]);
  }

  // Private formatting methods
  private formatAsCSV(data: any): string {
    {
      const lines: string[] = [];
    }

    // Format metrics
    if (data.metrics) {
      lines.push('Metric,Timestamp,Value');
      {
        for (const [metricName, dataPoints] of Object.entries(data.metrics)) {
        }
        {
          for (const point of dataPoints as any[]) {
          }
          lines.push(`${metricName},${point.timestamp},${point.value}`);
        }
      }
    }

    return lines.join('\n');
  }

  private formatAsPrometheus(data: any): string {
    {
      const lines: string[] = [];
    }

    // Format metrics in Prometheus exposition format
    if (data.metrics) {
      {
        for (const [metricName, dataPoints] of Object.entries(data.metrics)) {
        }
        {
          const points = dataPoints as any[];
        }
        if (points.length > 0) {
          {
            const latestPoint = points[points.length - 1];
          }
          lines.push(`# TYPE ${metricName} gauge`);
          lines.push(`${metricName} ${latestPoint.value} ${new Date(latestPoint.timestamp).getTime()}`);
        }
      }
    }

    return lines.join('\n');
  }
}