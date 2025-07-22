/**
 * @fileoverview Type definitions for the scheduler module
 * @module modules/core/scheduler/types
 */

export type TaskStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'cron' | 'interval' | 'once' | 'manual';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  schedule: string; // Cron expression or interval
  command: string;
  data?: Record<string, any>;
  status: TaskStatus;
  enabled: boolean;
  retries: number;
  retry_delay: number;
  timeout?: number;
  last_run?: Date;
  next_run?: Date;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface TaskExecution {
  id: string;
  task_id: string;
  status: ExecutionStatus;
  started_at: Date;
  completed_at?: Date;
  duration?: number;
  result?: Record<string, any>;
  error?: string;
  retry_count: number;
  logs?: string;
}

export interface TaskSchedule {
  task_id: string;
  cron_expression?: string;
  interval_ms?: number;
  run_at?: Date;
  timezone?: string;
  start_date?: Date;
  end_date?: Date;
  max_runs?: number;
}

export interface CreateTaskDto {
  name: string;
  description?: string;
  type?: TaskType;
  schedule: string;
  command: string;
  data?: Record<string, any>;
  retries?: number;
  retry_delay?: number;
  timeout?: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateTaskDto {
  name?: string;
  description?: string;
  schedule?: string;
  command?: string;
  data?: Record<string, any>;
  retries?: number;
  retry_delay?: number;
  timeout?: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

export interface TaskEvent {
  type: 'created' | 'updated' | 'deleted' | 'executed' | 'completed' | 'failed' | 'paused' | 'resumed';
  task_id: string;
  execution_id?: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface CronJob {
  id: string;
  expression: string;
  handler: () => void | Promise<void>;
  nextRun: Date;
  active: boolean;
}

export interface NextRunInfo {
  task_id: string;
  task_name: string;
  next_run: Date;
  schedule: string;
}

export interface TaskStats {
  total_tasks: number;
  active_tasks: number;
  paused_tasks: number;
  executions_today: number;
  executions_this_week: number;
  executions_this_month: number;
  success_rate: number;
  average_duration: number;
}

export interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
}

// Cron expression helpers
export interface CronField {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface IntervalSchedule {
  value: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}