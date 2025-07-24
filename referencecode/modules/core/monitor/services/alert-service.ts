/**
 * @fileoverview Alert management and evaluation service
 * @module modules/core/monitor/services
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { MonitorRepository } from '../repositories/monitor-repository.js';
import type { MetricService } from './metric-service.js';
import type { Alert, AlertConfig, AlertCondition, MetricQuery } from '../types/monitor.types.js';

export class AlertService extends EventEmitter {
  private evaluationInterval?: NodeJS.Timeout;
  private readonly activeAlerts: Map<string, Alert> = new Map();

  constructor(
    private readonly repository: MonitorRepository,
    private readonly metricService: MetricService,
    private readonly logger: any,
    private readonly config: any,
  ) {
    super();
  }

  async initialize(): Promise<void> {
    // Load active alerts from database
    const alerts = await this.repository.getActiveAlerts();
    alerts.forEach((alert) => {
      this.activeAlerts.set(alert.id, alert);
    });

    // Start alert evaluation interval
    const evalInterval = this.config?.alerts?.evaluationInterval ?? 60000;
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts().catch((error) => {
        this.logger?.error('Failed to evaluate alerts', { error });
      });
    }, evalInterval);

    // Run initial evaluation
    await this.evaluateAlerts();

    this.logger?.info('Alert service initialized', { activeAlerts: this.activeAlerts.size });
  }

  async shutdown(): Promise<void> {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }
  }

  // Get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return this.repository.getActiveAlerts();
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (alert.status !== 'active') {
      throw new Error(`Alert ${alertId} is not active`);
    }

    await this.repository.acknowledgeAlert(alertId, userId);

    // Update in-memory alert
    alert.status = 'acknowledged';
    alert.acknowledged_at = new Date();
    alert.acknowledged_by = userId;
    alert.updated_at = new Date();

    this.emit('alert:acknowledged', alert);
    this.logger?.info('Alert acknowledged', { alertId, userId });
  }

  // Create or update alert configuration
  async configureAlert(config: AlertConfig): Promise<void> {
    if (!config.id) {
      config.id = randomUUID();
      config.created_at = new Date();
    }
    config.updated_at = new Date();

    await this.repository.createAlertConfig(config);
    this.emit('alert:configured', config);
    this.logger?.info('Alert configured', { alertId: config.id, name: config.name });
  }

  // Get alert configurations
  async getAlertConfigs(): Promise<AlertConfig[]> {
    return this.repository.getAlertConfigs();
  }

  // Update alert configuration
  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    await this.repository.updateAlertConfig(id, updates);
    this.emit('alert:updated', { id, updates });
    this.logger?.info('Alert config updated', { id, updates });
  }

  // Private methods
  private async evaluateAlerts(): Promise<void> {
    try {
      const configs = await this.repository.getAlertConfigs();
      const enabledConfigs = configs.filter((c) => c.enabled);

      for (const config of enabledConfigs) {
        await this.evaluateAlertConfig(config);
      }

      // Check for resolved alerts
      for (const [alertId, alert] of this.activeAlerts) {
        if (alert.status === 'active' || alert.status === 'acknowledged') {
          // Re-evaluate to see if condition is still met
          const configMatch = configs.find((c) => c.name === alert.name);
          if (configMatch) {
            const conditionMet = await this.checkCondition(configMatch.condition);
            if (!conditionMet) {
              await this.resolveAlert(alertId);
            }
          }
        }
      }
    } catch (error) {
      this.logger?.error('Alert evaluation failed', { error });
    }
  }

  private async evaluateAlertConfig(config: AlertConfig): Promise<void> {
    try {
      const conditionMet = await this.checkCondition(config.condition);

      if (conditionMet) {
        // Check if alert already exists
        const existingAlert = Array.from(this.activeAlerts.values()).find(
          (a) => a.name === config.name && (a.status === 'active' || a.status === 'acknowledged'),
        );

        if (!existingAlert) {
          // Create new alert
          const alert: Alert = {
            id: randomUUID(),
            name: config.name,
            severity: config.severity,
            condition: config.condition,
            status: 'active',
            message: this.formatAlertMessage(config),
            created_at: new Date(),
            updated_at: new Date(),
            metadata: {
              config_id: config.id,
              threshold: config.condition.threshold,
              metric: config.condition.metric,
            },
          };

          await this.repository.createAlert(alert);
          this.activeAlerts.set(alert.id, alert);

          this.emit('alert:created', alert);
          this.logger?.warn('Alert triggered', {
            name: alert.name,
            severity: alert.severity,
            message: alert.message,
          });

          // Send notifications
          await this.sendAlertNotifications(alert, config);
        }
      }
    } catch (error) {
      this.logger?.error('Failed to evaluate alert config', {
        configId: config.id,
        name: config.name,
        error,
      });
    }
  }

  private async checkCondition(condition: AlertCondition): Promise<boolean> {
    try {
      // Query metric data
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (condition.duration || 300) * 1000); // Default 5 minutes

      const query: MetricQuery = {
        metric: condition.metric,
        start_time: startTime,
        end_time: endTime,
        aggregation: condition.aggregation,
      };

      const result = await this.metricService.queryMetrics(query);

      if (result.data.length === 0) {
        return false;
      }

      // Calculate aggregated value
      let value: number;
      const values = result.data.map((d) => d.value);

      switch (condition.aggregation || 'avg') {
        case 'avg':
          value = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          value = Math.min(...values);
          break;
        case 'max':
          value = Math.max(...values);
          break;
        case 'count':
          value = values.length;
          break;
        default:
          value = values[values.length - 1] as string;
      }

      // Evaluate condition
      switch (condition.operator) {
        case '>':
          return value > condition.threshold;
        case '<':
          return value < condition.threshold;
        case '>=':
          return value >= condition.threshold;
        case '<=':
          return value <= condition.threshold;
        case '==':
          return value === condition.threshold;
        case '!=':
          return value !== condition.threshold;
        default:
          return false;
      }
    } catch (error) {
      this.logger?.error('Failed to check alert condition', { condition, error });
      return false;
    }
  }

  private async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    await this.repository.resolveAlert(alertId);

    alert.status = 'resolved';
    alert.resolved_at = new Date();
    alert.updated_at = new Date();

    this.activeAlerts.delete(alertId);

    this.emit('alert:resolved', alert);
    this.logger?.info('Alert resolved', {
      alertId,
      name: alert.name,
      duration: alert.resolved_at.getTime() - alert.created_at.getTime(),
    });
  }

  private formatAlertMessage(config: AlertConfig): string {
    {
      const _condition = config.condition;
    }
    {
      const _operator = this.getOperatorText(_condition.operator);
    }
    {
      const _aggregation = _condition.aggregation || 'value';
    }

    return `${config.name}: ${_condition.metric} ${_aggregation} ${_operator} ${_condition.threshold}`;
  }

  private getOperatorText(operator: string): string {
    const operatorMap: Record<string, string> = {
      '>': 'is greater than',
      '<': 'is less than',
      '>=': 'is greater than or equal to',
      '<=': 'is less than or equal to',
      '==': 'equals',
      '!=': 'does not equal',
    };
    return operatorMap[operator] || operator;
  }

  private async sendAlertNotifications(alert: Alert, config: AlertConfig): Promise<void> {
    // This would integrate with notification channels
    // For now, just emit an event
    this.emit('alert:notify', { alert, channels: config.channels });
  }
}
