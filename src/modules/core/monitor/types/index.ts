/**
 * Monitor type definitions.
 */

/**
 * Metric type enumeration.
 */
export const enum MetricTypeEnum {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  CUSTOM = 'custom'
}

/**
 * Alert severity enumeration.
 */
export const enum AlertSeverityEnum {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert comparison operator enumeration.
 */
export const enum AlertComparisonEnum {
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUAL = 'eq',
  NOT_EQUAL = 'neq'
}

/**
 * System metric entity.
 */
export interface IMetric {
  id: number;
  metricType: MetricTypeEnum;
  metricName: string;
  metricValue: number;
  unit?: string;
  metadata?: Record<string, unknown>;
  recordedAt: Date;
}

/**
 * Monitor alert entity.
 */
export interface IMonitorAlert {
  id: string;
  name: string;
  description?: string;
  metricType: MetricTypeEnum;
  thresholdValue: number;
  comparison: AlertComparisonEnum;
  severity: AlertSeverityEnum;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert history entity.
 */
export interface IAlertHistory {
  id: number;
  alertId: string;
  metricValue: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  notificationSent: boolean;
}

/**
 * Monitor statistics.
 */
export interface IMonitorStats {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
}

/**
 * Monitor service interface.
 */
export interface IMonitorService {
  recordMetric(
    type: MetricTypeEnum,
    name: string,
    value: number,
    unit?: string
  ): Promise<IMetric>;
  getMetrics(type?: MetricTypeEnum, limit?: number): Promise<IMetric[]>;
  createAlert(alert: Omit<IMonitorAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<IMonitorAlert>;
  getAlerts(): Promise<IMonitorAlert[]>;
  checkAlerts(): Promise<void>;
  getSystemStats(): Promise<IMonitorStats>;
}