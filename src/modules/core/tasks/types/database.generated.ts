// Auto-generated database types for tasks module
// Generated on: 2025-07-29T15:52:59.251Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped'
}

/**
 * Generated from database table: task
 * Do not modify this file manually - it will be overwritten
 */
export interface ITaskRow {
  id: number;
  type: string;
  module_id: string;
  instructions: string | null; // JSON string, requires parsing
  priority: number | null;
  status: TaskStatus | null;
  retry_count: number | null;
  max_executions: number | null;
  max_time: number | null;
  result: string | null;
  error: string | null;
  progress: number | null;
  assigned_agent_id: string | null;
  scheduled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  metadata: string | null; // JSON string, requires parsing
}

/**
 * Union type of all database row types in this module
 */
export type TasksDatabaseRow = ITaskRow;

/**
 * Database table names for this module
 */
export const TASKS_TABLES = {
  TASK: 'task',
} as const;
