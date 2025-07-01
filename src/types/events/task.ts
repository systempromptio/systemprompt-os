/**
 * @fileoverview Task-related event type definitions
 * @module types/events/task
 * @since 1.0.0
 */

import { Task, TaskStatus, TaskResult, TaskId } from '../task.js';
import { SessionId } from '../core/session.js';

/**
 * Map of task event types to their handler signatures
 * @since 1.0.0
 */
export type TaskEventMap = {
  /**
   * Fired when a new task is created
   * @since 1.0.0
   */
  'task:created': (data: TaskCreatedEvent) => void;
  
  /**
   * Fired when a task is updated
   * @since 1.0.0
   */
  'task:updated': (data: TaskUpdatedEvent) => void;
  
  /**
   * Fired when a task's status changes
   * @since 1.0.0
   */
  'task:status:changed': (data: TaskStatusChangedEvent) => void;
  
  /**
   * Fired when task progress is reported
   * @since 1.0.0
   */
  'task:progress': (data: TaskProgressEvent) => void;
  
  /**
   * Fired when a task completes successfully
   * @since 1.0.0
   */
  'task:completed': (data: TaskCompletedEvent) => void;
  
  /**
   * Fired when a task fails
   * @since 1.0.0
   */
  'task:failed': (data: TaskFailedEvent) => void;
  
  /**
   * Fired when a log entry is added to a task
   * @since 1.0.0
   */
  'task:log': (data: TaskLogEvent) => void;
  
  /**
   * Fired when a task is deleted
   * @since 1.0.0
   */
  'task:deleted': (data: TaskDeletedEvent) => void;
};

/**
 * Event data for task creation
 * @interface
 * @since 1.0.0
 */
export interface TaskCreatedEvent {
  /**
   * The created task
   * @since 1.0.0
   */
  readonly task: Task;
  
  /**
   * Session the task belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * When the task was created
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task updates
 * @interface
 * @since 1.0.0
 */
export interface TaskUpdatedEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Updated task object
   * @since 1.0.0
   */
  readonly task: Task;
  
  /**
   * Fields that were changed
   * @since 1.0.0
   */
  readonly changes: Partial<Task>;
  
  /**
   * When the task was updated
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task status changes
 * @interface
 * @since 1.0.0
 */
export interface TaskStatusChangedEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Previous task status
   * @since 1.0.0
   */
  readonly previousStatus: TaskStatus;
  
  /**
   * New task status
   * @since 1.0.0
   */
  readonly newStatus: TaskStatus;
  
  /**
   * When the status changed
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task progress updates
 * @interface
 * @since 1.0.0
 */
export interface TaskProgressEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Progress percentage (0-100)
   * @since 1.0.0
   */
  readonly progress: number;
  
  /**
   * Optional progress message
   * @since 1.0.0
   */
  readonly message?: string;
  
  /**
   * When the progress was reported
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task completion
 * @interface
 * @since 1.0.0
 */
export interface TaskCompletedEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Task execution result
   * @since 1.0.0
   */
  readonly result: TaskResult;
  
  /**
   * Task execution duration in milliseconds
   * @since 1.0.0
   */
  readonly duration: number;
  
  /**
   * When the task completed
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task failure
 * @interface
 * @since 1.0.0
 */
export interface TaskFailedEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Error information
   * @since 1.0.0
   */
  readonly error: {
    /**
     * Error code for programmatic handling
     * @since 1.0.0
     */
    readonly code: string;
    
    /**
     * Human-readable error message
     * @since 1.0.0
     */
    readonly message: string;
    
    /**
     * Additional error details
     * @since 1.0.0
     */
    readonly details?: unknown;
  };
  
  /**
   * When the task failed
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task log entries
 * @interface
 * @since 1.0.0
 */
export interface TaskLogEvent {
  /**
   * Unique identifier for the task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * Log message content
   * @since 1.0.0
   */
  readonly log: string;
  
  /**
   * Log severity level
   * @default 'info'
   * @since 1.0.0
   */
  readonly level?: 'info' | 'warning' | 'error' | 'debug';
  
  /**
   * When the log was created
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for task deletion
 * @interface
 * @since 1.0.0
 */
export interface TaskDeletedEvent {
  /**
   * Unique identifier for the deleted task
   * @since 1.0.0
   */
  readonly taskId: TaskId;
  
  /**
   * When the task was deleted
   * @since 1.0.0
   */
  readonly timestamp: Date;
}