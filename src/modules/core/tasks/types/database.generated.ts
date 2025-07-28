// Auto-generated database types for tasks module
// Generated on: 2025-07-28T19:59:56.310Z
// Do not modify this file manually - it will be overwritten

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
  status: string | null;
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
