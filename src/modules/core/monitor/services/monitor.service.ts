/* eslint-disable
  logical-assignment-operators,
  @typescript-eslint/no-unnecessary-condition,
  @typescript-eslint/strict-boolean-expressions,
  @typescript-eslint/await-thenable,
  systemprompt-os/no-block-comments
*/
/**
 * Monitor service implementation - manages system monitoring and alerts.
 * @file Monitor service implementation.
 * @module monitor/services
 * Provides business logic for system monitoring operations.
 */

import { randomUUID } from 'crypto';
import * as os from 'os';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { MonitorRepository } from '@/modules/core/monitor/repositories/monitor-repository.js';
import {
  type MetricTypeEnum,
  type AlertSeverityEnum,
  type AlertComparisonEnum,
  type IMetric,
  type IMonitorAlert,
  type IMonitorStats,
  type IMonitorService
} from '@/modules/core/monitor/types/index.js';

/**
 * Service for managing system monitoring.
 */
export class MonitorService implements IMonitorService {
  private static instance: MonitorService;
  private readonly repository: MonitorRepository;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = MonitorRepository.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The monitor service instance.
   */
  static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info('MonitorService initialized');
  }

  /**
   * Record a metric.
   * @param type - The metric type.
   * @param name - The metric name.
   * @param value - The metric value.
   * @param unit - Optional unit.
   * @returns Promise that resolves to the recorded metric.
   */
  async recordMetric(
    type: MetricTypeEnum,
    name: string,
    value: number,
    unit?: string
  ): Promise<IMetric> {
    await this.ensureInitialized();

    this.logger?.debug(`Recording metric: ${type}/${name} = ${value}${unit ? ` ${unit}` : ''}`);
    const metric = await this.repository.createMetric(type, name, value, unit);

    // Check alerts after recording metric
    await this.checkAlerts();

    return metric;
  }

  /**
   * Get metrics.
   * @param type - Optional metric type filter.
   * @param limit - Optional limit.
   * @returns Promise that resolves to array of metrics.
   */
  async getMetrics(type?: MetricTypeEnum, limit?: number): Promise<IMetric[]> {
    await this.ensureInitialized();
    return await this.repository.findMetrics(type, limit);
  }

  /**
   * Create an alert.
   * @param alert - The alert data.
   * @returns Promise that resolves to the created alert.
   */
  async createAlert(
    alert: Omit<IMonitorAlert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IMonitorAlert> {
    await this.ensureInitialized();

    const id = randomUUID();
    this.logger?.info(`Creating monitor alert: ${alert.name}`);

    const createdAlert = await this.repository.createAlert(id, alert);
    this.logger?.info(`Created monitor alert: ${id}`);

    return createdAlert;
  }

  /**
   * Get all alerts.
   * @returns Promise that resolves to array of alerts.
   */
  async getAlerts(): Promise<IMonitorAlert[]> {
    await this.ensureInitialized();
    return await this.repository.findAllAlerts();
  }

  /**
   * Check alerts against current metrics.
   * @returns Promise that resolves when checked.
   */
  async checkAlerts(): Promise<void> {
    await this.ensureInitialized();

    const alerts = await this.repository.findEnabledAlerts();
    for (const alert of alerts) {
      const metrics = await this.repository.findLatestMetric(alert.metricType);
      if (metrics.length > 0) {
        const metric = metrics[0];
        if (this.shouldTriggerAlert(alert, metric.metricValue)) {
          await this.triggerAlert(alert, metric.metricValue);
        }
      }
    }
  }

  /**
   * Get system statistics.
   * @returns Promise that resolves to system stats.
   */
  async getSystemStats(): Promise<IMonitorStats> {
    await this.ensureInitialized();

    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage (simplified)
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      disk: {
        // Placeholder values - would need platform-specific implementation
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      }
    };
  }

  /**
   * Check if alert should be triggered.
   * @param alert - The alert configuration.
   * @param value - The current metric value.
   * @returns True if alert should be triggered.
   */
  private shouldTriggerAlert(alert: IMonitorAlert, value: number): boolean {
    switch (alert.comparison) {
      case 'gt':
        return value > alert.thresholdValue;
      case 'gte':
        return value >= alert.thresholdValue;
      case 'lt':
        return value < alert.thresholdValue;
      case 'lte':
        return value <= alert.thresholdValue;
      case 'eq':
        return value === alert.thresholdValue;
      case 'neq':
        return value !== alert.thresholdValue;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert.
   * @param alert - The alert configuration.
   * @param value - The metric value that triggered the alert.
   * @returns Promise that resolves when triggered.
   */
  private async triggerAlert(alert: IMonitorAlert, value: number): Promise<void> {
    this.logger?.warn(`Alert triggered: ${alert.name} (value: ${value})`);
    await this.repository.createAlertHistory(alert.id, value);
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}