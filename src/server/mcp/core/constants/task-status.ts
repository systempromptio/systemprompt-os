/**
 * Task status constants
 */

export const TaskStatus = {
  PENDING: 'pending',
  INPROGRESS: 'inprogress',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export const TERMINALSTATUSES = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED
] as const;

export const ACTIVESTATUSES = [
  TaskStatus.PENDING,
  TaskStatus.INPROGRESS,
  TaskStatus.WAITING
] as const;