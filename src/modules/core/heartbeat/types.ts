/**
 * @fileoverview Type definitions for the heartbeat monitoring module
 * @module modules/core/heartbeat/types
 * @author SystemPrompt OS
 * @version 1.0.0
 */

/**
 * Available metric types that can be included in heartbeat status
 */
export type HeartbeatMetric = 'timestamp' | 'status' | 'uptime' | 'memory' | 'cpu' | 'version';

/**
 * Configuration options for the heartbeat module
 */
export interface HeartbeatConfig {
  /**
   * Interval between heartbeat writes
   * @example "500ms", "30s", "5m", "1h"
   */
  interval: string;
  
  /**
   * File path where heartbeat status will be written
   * @example "/var/log/heartbeat/status.json"
   */
  outputPath: string;
  
  /**
   * Whether to automatically start the heartbeat daemon on initialization
   * @default false
   */
  autoStart?: boolean;
  
  /**
   * List of metrics to include in the heartbeat status
   * @default ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version']
   */
  includeMetrics?: HeartbeatMetric[];
}

/**
 * Memory usage information
 */
export interface MemoryInfo {
  /**
   * Memory used in megabytes (MB)
   */
  used: number;
  
  /**
   * Total memory available in megabytes (MB)
   */
  total: number;
  
  /**
   * Memory usage percentage (0-100)
   */
  percentage: number;
}

/**
 * CPU usage information
 */
export interface CpuInfo {
  /**
   * CPU usage percentage (0-100) based on load average
   */
  usage: number;
  
  /**
   * System load averages for 1, 5, and 15 minutes
   */
  loadAverage: [number, number, number];
}

/**
 * Complete heartbeat status object written to the output file
 */
export interface HeartbeatStatus {
  /**
   * ISO 8601 timestamp of when the heartbeat was generated
   * @example "2023-12-01T12:00:00.000Z"
   */
  timestamp: string;
  
  /**
   * Current health status of the system
   */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /**
   * System uptime in seconds (optional based on config)
   */
  uptime?: number;
  
  /**
   * Memory usage information (optional based on config)
   */
  memory?: MemoryInfo;
  
  /**
   * CPU usage information (optional based on config)
   */
  cpu?: CpuInfo;
  
  /**
   * Module version (optional based on config)
   */
  version?: string;
}

/**
 * Time unit suffixes supported for interval configuration
 */
export type TimeUnit = 'ms' | 's' | 'm' | 'h';

/**
 * Logger log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';