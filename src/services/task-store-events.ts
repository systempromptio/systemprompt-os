/**
 * @fileoverview Type-safe event definitions for TaskStore
 * @module services/task-store-events
 * 
 * @remarks
 * This module provides type-safe event definitions for the TaskStore service,
 * ensuring compile-time type checking for event listeners and emitters.
 * 
 * @example
 * ```typescript
 * import type { TypedTaskStoreEmitter } from './services/task-store-events';
 * 
 * class MyTaskStore implements TypedTaskStoreEmitter {
 *   // Implementation
 * }
 * 
 * const store = new MyTaskStore();
 * store.on('task:created', (task) => {
 *   // TypeScript knows task is of type Task
 *   console.log('New task:', task.description);
 * });
 * ```
 */

import type { Task, TaskLogEntry } from "../types/task.js";

/**
 * Type-safe event map for TaskStore
 * 
 * @interface TaskStoreEventMap
 * 
 * @remarks
 * Defines all events emitted by the TaskStore and their associated data types.
 * This ensures type safety when listening to or emitting events.
 */
export interface TaskStoreEventMap {
  /**
   * Emitted when a new task is created
   */
  "task:created": (task: Task) => void;
  
  /**
   * Emitted when a task is updated
   */
  "task:updated": (task: Task) => void;
  
  /**
   * Emitted when a task is deleted
   */
  "task:deleted": (data: { taskId: string }) => void;
  
  /**
   * Emitted when a log entry is added to a task
   */
  "task:log": (data: { taskId: string; log: TaskLogEntry }) => void;
  
  /**
   * Emitted when task progress is updated
   */
  "task:progress": (data: { taskId: string; elapsed_seconds: number }) => void;
}

/**
 * Type-safe event emitter interface for TaskStore
 * 
 * @interface TypedTaskStoreEmitter
 * 
 * @remarks
 * Provides type-safe methods for event handling in the TaskStore.
 * This interface ensures that event names and their associated data types
 * are correctly matched at compile time.
 */
export interface TypedTaskStoreEmitter {
  /**
   * Adds a listener for the specified event
   * 
   * @template K - The event name from TaskStoreEventMap
   * @param event - The event to listen for
   * @param listener - The callback function to execute when the event is emitted
   * @returns This instance for method chaining
   */
  on<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;

  /**
   * Emits the specified event with the provided arguments
   * 
   * @template K - The event name from TaskStoreEventMap
   * @param event - The event to emit
   * @param args - The arguments to pass to the event listeners
   * @returns True if the event had listeners, false otherwise
   */
  emit<K extends keyof TaskStoreEventMap>(
    event: K,
    ...args: Parameters<TaskStoreEventMap[K]>
  ): boolean;

  /**
   * Removes a listener for the specified event
   * 
   * @template K - The event name from TaskStoreEventMap
   * @param event - The event to stop listening for
   * @param listener - The callback function to remove
   * @returns This instance for method chaining
   */
  off<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;

  /**
   * Adds a one-time listener for the specified event
   * 
   * @template K - The event name from TaskStoreEventMap
   * @param event - The event to listen for once
   * @param listener - The callback function to execute when the event is emitted
   * @returns This instance for method chaining
   */
  once<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;
}