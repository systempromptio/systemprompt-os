/**
 * @file Task status constants
 * @module constants/task-status
 * 
 * Single source of truth for task status values.
 * Import and use these constants instead of hardcoding status strings.
 */

/**
 * Task status constants matching the TaskStatus type from types/task.ts
 */
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED_ACTIVE: 'completed_active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type TaskStatusValue = typeof TASK_STATUS[keyof typeof TASK_STATUS];