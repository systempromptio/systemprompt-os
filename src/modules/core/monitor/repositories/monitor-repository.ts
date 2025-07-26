/**
 * Metric data structure for storage and retrieval.
 */
export interface IMetricData {
  timestamp: Date;
  value: number;
  name?: string;
  type?: string;
  labels?: Record<string, string>;
  unit?: string;
}

/**
 * Query parameters for retrieving metrics.
 */
export interface IMetricQuery {
  metric: string;
  start_time?: Date;
  end_time?: Date;
  labels?: Record<string, string>;
}

/**
 * Query result structure.
 */
export interface IMetricQueryResult {
  metric: string;
  data: IMetricData[];
  labels: Record<string, string>;
}

/**
 * Repository interface for managing metric data storage and retrieval.
 */
export interface MonitorRepository {
    recordMetric(data: IMetricData): Promise<void>;

    getMetrics(query: IMetricQuery): Promise<IMetricData[]>;

    getMetricNames(): Promise<string[]>;

    deleteOldMetrics(retentionDays: number): Promise<void>;
}
