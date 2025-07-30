// Auto-generated database types for monitor module
// Generated on: 2025-07-30T17:51:34.142Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram'
}

/**
 * Generated from database table: metric
 * Do not modify this file manually - it will be overwritten
 */
export interface IMetricRow {
  id: number;
  name: string;
  value: number;
  type: MetricType;
  unit: string | null;
  timestamp: string;
  created_at: string | null;
}

/**
 * Generated from database table: metric_label
 * Do not modify this file manually - it will be overwritten
 */
export interface IMetricLabelRow {
  id: number;
  metric_id: number;
  label_key: string;
  label_value: string;
  created_at: string | null;
}

/**
 * Generated from database table: system_metric
 * Do not modify this file manually - it will be overwritten
 */
export interface ISystemMetricRow {
  id: number;
  cpu_cores: number | null;
  cpu_usage: number | null;
  memory_total: number | null;
  memory_free: number | null;
  memory_used: number | null;
  disk_total: number | null;
  disk_free: number | null;
  disk_used: number | null;
  network_bytes_in: number | null;
  network_bytes_out: number | null;
  uptime: number | null;
  timestamp: string;
  created_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type MonitorDatabaseRow = IMetricRow | IMetricLabelRow | ISystemMetricRow;

/**
 * Database table names for this module
 */
export const MONITOR_TABLES = {
  METRIC: 'metric',
  METRICLABEL: 'metric_label',
  SYSTEMMETRIC: 'system_metric',
} as const;
