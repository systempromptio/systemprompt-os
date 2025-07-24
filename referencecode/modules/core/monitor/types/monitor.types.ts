/**
 * @fileoverview Type definitions for monitor module
 * @module modules/core/monitor/types
 */

export interface MonitorModuleConfig {
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  alerts: {
    enabled: boolean;
    channels: AlertChannel[];
  };
  traces: {
    enabled: boolean;
    sampling: number;
  };
}

export interface MetricData {
  id: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
  unit?: string;
  description?: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  condition: AlertCondition;
  status: 'active' | 'resolved' | 'acknowledged';
  message: string;
  created_at: Date;
  updated_at: Date;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  resolved_at?: Date;
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration?: number; // in seconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertConfig {
  id: string;
  name: string;
  description?: string;
  condition: AlertCondition;
  severity: 'critical' | 'warning' | 'info';
  channels: string[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Trace {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  service_name: string;
  start_time: Date;
  end_time?: Date;
  duration?: number;
  status: 'ok' | 'error' | 'cancelled';
  attributes: Record<string, any>;
  events: TraceEvent[];
  links: TraceLink[];
}

export interface TraceEvent {
  timestamp: Date;
  name: string;
  attributes: Record<string, any>;
}

export interface TraceLink {
  trace_id: string;
  span_id: string;
  attributes: Record<string, any>;
}

export interface MonitoringExport {
  format: 'json' | 'csv' | 'prometheus';
  start_date?: Date;
  end_date?: Date;
  metrics?: string[];
  include_alerts?: boolean;
  include_traces?: boolean;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    load_average: number[];
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
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
  };
  uptime: number;
}

export interface MetricQuery {
  metric: string;
  start_time?: Date;
  end_time?: Date;
  labels?: Record<string, string>;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  group_by?: string[];
  interval?: string; // e.g., '5m', '1h', '1d'
}

export interface MetricResult {
  metric: string;
  data: MetricDataPoint[];
  labels: Record<string, string>;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

export interface MonitorStatus {
  healthy: boolean;
  metrics: {
    total: number;
    active: number;
    rate: number; // per minute
  };
  alerts: {
    active: number;
    acknowledged: number;
    resolved_today: number;
  };
  traces: {
    total: number;
    error_rate: number;
    avg_duration: number;
  };
  system: SystemMetrics;
}