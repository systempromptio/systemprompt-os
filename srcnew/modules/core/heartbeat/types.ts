/**
 * Heartbeat module type definitions
 */

export interface HeartbeatConfig {
  /**
   * Interval between heartbeat writes (e.g., "30s", "5m", "1h")
   */
  interval: string;
  
  /**
   * Path where heartbeat JSON will be written
   */
  outputPath: string;
  
  /**
   * Whether to start heartbeat automatically on module initialization
   */
  autoStart?: boolean;
  
  /**
   * Which metrics to include in the heartbeat status
   */
  includeMetrics?: HeartbeatMetric[];
}

export type HeartbeatMetric = 
  | 'timestamp'
  | 'status'
  | 'uptime'
  | 'memory'
  | 'cpu'
  | 'version';

export interface HeartbeatStatus {
  /**
   * ISO 8601 timestamp
   */
  timestamp: string;
  
  /**
   * Current health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /**
   * System uptime in seconds
   */
  uptime?: number;
  
  /**
   * Memory usage information
   */
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  
  /**
   * CPU usage information
   */
  cpu?: {
    usage: number;
    loadAverage: number[];
  };
  
  /**
   * System version
   */
  version?: string;
}