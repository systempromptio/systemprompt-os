// Auto-generated database types for tasks module
// Generated on: 2025-07-31T10:03:21.443Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for enums
export const TaskStatusSchema = z.nativeEnum(TaskStatus);

/**
 * Generated from database table: task
 * Do not modify this file manually - it will be overwritten
 */
export interface ITaskRow {
  id: number;
  type: string;
  module_id: string;
  instructions: string | null;
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
}

/**
 * Generated from database table: task_metadata
 * Do not modify this file manually - it will be overwritten
 */
export interface ITaskMetadataRow {
  id: number;
  task_id: number;
  key: string;
  value: string | null;
  created_at: string | null;
}

// Zod schemas for database row validation
export const TaskRowSchema = z.object({
  id: z.number(),
  type: z.string(),
  module_id: z.string(),
  instructions: z.string().nullable(),
  priority: z.number().nullable(),
  status: z.nativeEnum(TaskStatus).nullable(),
  retry_count: z.number().nullable(),
  max_executions: z.number().nullable(),
  max_time: z.number().nullable(),
  result: z.string().nullable(),
  error: z.string().nullable(),
  progress: z.number().nullable(),
  assigned_agent_id: z.string().nullable(),
  scheduled_at: z.string().datetime().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_by: z.string().nullable(),
});

export const TaskMetadataRowSchema = z.object({
  id: z.number(),
  task_id: z.number(),
  key: z.string(),
  value: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type TasksDatabaseRow = ITaskRow | ITaskMetadataRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const TasksDatabaseRowSchema = z.union([TaskRowSchema, TaskMetadataRowSchema]);

/**
 * Database table names for this module
 */
export const TASKS_TABLES = {
  TASK: 'task',
  TASKMETADATA: 'task_metadata',
} as const;
