/**
 * @fileoverview Task-related event type definitions
 * @module types/events/task
 */

import { Task, TaskStatus, TaskResult, TaskId } from '../task.js';
import { SessionId } from '../core/session.js';

/**
 * Map of task event types to their handler signatures
 */
export type TaskEventMap = {
  /**
   * Fired when a new task is created
   */
  'task:created': (data: TaskCreatedEvent) => void;
  
  /**
   * Fired when a task is updated
   */
  'task:updated': (data: TaskUpdatedEvent) => void;
  
  /**
   * Fired when a task's status changes
   */
  'task:status:changed': (data: TaskStatusChangedEvent) => void;
  
  /**
   * Fired when task progress is reported
   */
  'task:progress': (data: TaskProgressEvent) => void;
  
  /**
   * Fired when a task completes successfully
   */
  'task:completed': (data: TaskCompletedEvent) => void;
  
  /**
   * Fired when a task fails
   */
  'task:failed': (data: TaskFailedEvent) => void;
  
  /**
   * Fired when a log entry is added to a task
   */
  'task:log': (data: TaskLogEvent) => void;
  
  /**
   * Fired when a task is deleted
   */
  'task:deleted': (data: TaskDeletedEvent) => void;
};

/**
 * Event data for task creation
 * @interface
 */
export interface TaskCreatedEvent {
  /**
   * The created task
   */
  readonly task: Task;
  
  /**
   * Session the task belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * When the task was created
   */
  readonly timestamp: Date;
}

/**
 * Event data for task updates
 * @interface
 */
export interface TaskUpdatedEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Updated task object
   */
  readonly task: Task;
  
  /**
   * Fields that were changed
   */
  readonly changes: Partial<Task>;
  
  /**
   * When the task was updated
   */
  readonly timestamp: Date;
}

/**
 * Event data for task status changes
 * @interface
 */
export interface TaskStatusChangedEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Previous task status
   */
  readonly previousStatus: TaskStatus;
  
  /**
   * New task status
   */
  readonly newStatus: TaskStatus;
  
  /**
   * When the status changed
   */
  readonly timestamp: Date;
}

/**
 * Event data for task progress updates
 * @interface
 */
export interface TaskProgressEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Progress percentage (0-100)
   */
  readonly progress: number;
  
  /**
   * Optional progress message
   */
  readonly message?: string;
  
  /**
   * When the progress was reported
   */
  readonly timestamp: Date;
}

/**
 * Event data for task completion
 * @interface
 */
export interface TaskCompletedEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Task execution result
   */
  readonly result: TaskResult;
  
  /**
   * Task execution duration in milliseconds
   */
  readonly duration: number;
  
  /**
   * When the task completed
   */
  readonly timestamp: Date;
}

/**
 * Event data for task failure
 * @interface
 */
export interface TaskFailedEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Error information
   */
  readonly error: {
    /**
     * Error code for programmatic handling
     */
    readonly code: string;
    
    /**
     * Human-readable error message
     */
    readonly message: string;
    
    /**
     * Additional error details
     */
    readonly details?: unknown;
  };
  
  /**
   * When the task failed
   */
  readonly timestamp: Date;
}

/**
 * Event data for task log entries
 * @interface
 */
export interface TaskLogEvent {
  /**
   * Unique identifier for the task
   */
  readonly taskId: TaskId;
  
  /**
   * Log message content
   */
  readonly log: string;
  
  /**
   * Log severity level
   * @default 'info'
   */
  readonly level?: 'info' | 'warning' | 'error' | 'debug';
  
  /**
   * When the log was created
   */
  readonly timestamp: Date;
}

/**
 * Event data for task deletion
 * @interface
 */
export interface TaskDeletedEvent {
  /**
   * Unique identifier for the deleted task
   */
  readonly taskId: TaskId;
  
  /**
   * When the task was deleted
   */
  readonly timestamp: Date;
}