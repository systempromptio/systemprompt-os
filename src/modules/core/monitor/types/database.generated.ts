// Auto-generated database types for monitor module
// Generated on: 2025-07-31T15:21:00.663Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Enums generated from CHECK constraints
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram'
}

// Zod schemas for enums
export const MetricTypeSchema = z.nativeEnum(MetricType);

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

// Zod schemas for database row validation
export const MetricRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.number(),
  type: z.nativeEnum(MetricType),
  unit: z.string().nullable(),
  timestamp: z.string().datetime(),
  created_at: z.string().datetime().nullable(),
});

export const MetricLabelRowSchema = z.object({
  id: z.number(),
  metric_id: z.number(),
  label_key: z.string(),
  label_value: z.string(),
  created_at: z.string().datetime().nullable(),
});

export const SystemMetricRowSchema = z.object({
  id: z.number(),
  cpu_cores: z.number().nullable(),
  cpu_usage: z.number().nullable(),
  memory_total: z.number().nullable(),
  memory_free: z.number().nullable(),
  memory_used: z.number().nullable(),
  disk_total: z.number().nullable(),
  disk_free: z.number().nullable(),
  disk_used: z.number().nullable(),
  network_bytes_in: z.number().nullable(),
  network_bytes_out: z.number().nullable(),
  uptime: z.number().nullable(),
  timestamp: z.string().datetime(),
  created_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type MonitorDatabaseRow = IMetricRow | IMetricLabelRow | ISystemMetricRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const MonitorDatabaseRowSchema = z.union([MetricRowSchema, MetricLabelRowSchema, SystemMetricRowSchema]);

/**
 * Database table names for this module
 */
export const MONITOR_TABLES = {
  METRIC: 'metric',
  METRIC_LABEL: 'metric_label',
  SYSTEM_METRIC: 'system_metric',
} as const;
