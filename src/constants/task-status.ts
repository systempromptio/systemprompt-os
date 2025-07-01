/**
 * @fileoverview Task status constants
 * @module constants/task-status
 * @since 1.0.0
 * 
 * @remarks
 * Single source of truth for task status values.
 * Import and use these constants instead of hardcoding status strings.
 */

/**
 * Task status constants matching the TaskStatus type from types/task.ts
 * @since 1.0.0
 */
export const TASK_STATUS = {
  /** Task is waiting to be started */
  PENDING: 'pending',
  /** Task is currently being processed */
  IN_PROGRESS: 'in_progress',
  /** Task completed but session still active for updates */
  COMPLETED_ACTIVE: 'completed_active',
  /** Task completed and session terminated */
  COMPLETED: 'completed',
  /** Task execution failed */
  FAILED: 'failed',
  /** Task was cancelled */
  CANCELLED: 'cancelled'
} as const;

/**
 * Type representing any valid task status value
 * @since 1.0.0
 */
export type TaskStatusValue = typeof TASK_STATUS[keyof typeof TASK_STATUS];