// Auto-generated Zod schemas for tasks module
// Generated on: 2025-07-31T15:10:50.774Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { TasksDatabaseRowSchema } from './database.generated';

// Task schema - directly use database row schema
export const TaskSchema = TasksDatabaseRowSchema;

export const TaskCreateDataSchema = z.object({
  type: z.string(),
  module_id: z.string(),
  instructions: z.string().nullable(),
  priority: z.number().nullable(),
  status: z.unknown().nullable(),
  retry_count: z.number().nullable(),
  max_executions: z.number().nullable(),
  max_time: z.number().nullable(),
  result: z.string().nullable(),
  error: z.string().nullable(),
  progress: z.number().nullable(),
  assigned_agent_id: z.string().nullable(),
  scheduled_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_by: z.string().nullable(),
});

export const TaskUpdateDataSchema = z.object({
  type: z.string().optional(),
  module_id: z.string().optional(),
  instructions: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
  status: z.unknown().nullable().optional(),
  retry_count: z.number().nullable().optional(),
  max_executions: z.number().nullable().optional(),
  max_time: z.number().nullable().optional(),
  result: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  progress: z.number().nullable().optional(),
  assigned_agent_id: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
});

// Type inference from schemas
export type Task = z.infer<typeof TaskSchema>;
export type TaskCreateData = z.infer<typeof TaskCreateDataSchema>;
export type TaskUpdateData = z.infer<typeof TaskUpdateDataSchema>;

// Domain type aliases for easier imports
export type ITask = Task;
export type ITaskCreateData = TaskCreateData;
export type ITaskUpdateData = TaskUpdateData;
