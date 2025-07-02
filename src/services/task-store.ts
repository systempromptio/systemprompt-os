/**
 * @fileoverview Task store service for managing task state and persistence
 * @module services/task-store
 * 
 * @remarks
 * This service provides a centralized store for managing task state, persistence,
 * and notifications. It implements a singleton pattern to ensure consistent state
 * across the application and uses event-driven updates for real-time notifications.
 * 
 * @example
 * ```typescript
 * import { TaskStore } from './services/task-store';
 * 
 * const store = TaskStore.getInstance();
 * 
 * // Create a new task
 * await store.createTask({
 *   id: 'task-123',
 *   description: 'Implement authentication',
 *   status: 'in_progress',
 *   // ... other fields
 * });
 * 
 * // Listen for task updates
 * store.on('task:updated', (task) => {
 *   console.log('Task updated:', task.id);
 * });
 * ```
 */

import { EventEmitter } from "events";
import { StatePersistence } from "./state-persistence.js";
import {
  sendResourcesUpdatedNotification,
  sendResourcesListChangedNotification,
} from "../handlers/notifications.js";
import type { Task, TaskLogEntry } from "../types/task.js";
import type { ApplicationState, TaskFilter } from "../types/state.js";
import type { TypedTaskStoreEmitter } from "./task-store-events.js";
import { logger } from "../utils/logger.js";

/**
 * Manages task state, persistence, and notifications
 * 
 * @class TaskStore
 * @extends EventEmitter
 * @implements {TypedTaskStoreEmitter}
 * 
 * @remarks
 * This class is responsible for:
 * - Managing task lifecycle (create, read, update, delete)
 * - Persisting task state to disk
 * - Emitting events for task changes
 * - Sending MCP notifications for resource updates
 * - Calculating task metrics
 */
export class TaskStore extends EventEmitter implements TypedTaskStoreEmitter {
  private static instance: TaskStore;
  private tasks: Map<string, Task> = new Map();
  private persistence: StatePersistence;

  private constructor() {
    super();
    this.persistence = StatePersistence.getInstance();
    this.loadPersistedTasks();

    // Auto-save state on task changes
    (this as TypedTaskStoreEmitter).on("task:created", () => this.persistState());
    (this as TypedTaskStoreEmitter).on("task:updated", () => this.persistState());
  }

  /**
   * Gets singleton instance of TaskStore
   * 
   * @returns The singleton TaskStore instance
   * 
   * @example
   * ```typescript
   * const store = TaskStore.getInstance();
   * ```
   */
  static getInstance(): TaskStore {
    if (!TaskStore.instance) {
      TaskStore.instance = new TaskStore();
    }
    return TaskStore.instance;
  }

  /**
   * Loads persisted tasks from storage on startup
   * 
   * @private
   */
  private async loadPersistedTasks(): Promise<void> {
    try {
      logger.info('[TaskStore] Loading persisted tasks from disk...');
      const tasks = await this.persistence.loadTasks();
      logger.info(`[TaskStore] Found ${tasks.length} task files on disk`);
      
      for (const task of tasks) {
        this.tasks.set(task.id, task);
        logger.debug(`[TaskStore] Loaded task: ${task.id} - ${task.description}`);
      }
      logger.info(`[TaskStore] Loaded ${tasks.length} persisted tasks into memory`);
    } catch (error) {
      logger.error('[TaskStore] Failed to load persisted tasks:', error);
    }
  }

  /**
   * Persists current state to storage
   * 
   * @private
   */
  private async persistState(): Promise<void> {
    try {
      const state = await this.getState();
      await this.persistence.saveState(state);
    } catch (error) {
      logger.error('Failed to persist state:', error);
    }
  }

  /**
   * Gets current application state including all tasks and metrics
   * 
   * @returns Current application state with tasks and metrics
   * 
   * @example
   * ```typescript
   * const state = await store.getState();
   * console.log(`Total tasks: ${state.metrics.total_tasks}`);
   * ```
   */
  async getState(): Promise<ApplicationState> {
    const tasks = Array.from(this.tasks.values());
    const metrics = {
      total_tasks: tasks.length,
      completed_tasks: tasks.filter((t) => t.status === "completed").length,
      failed_tasks: tasks.filter((t) => t.status === "failed").length,
      average_completion_time: this.calculateAverageCompletionTime(),
    };

    return {
      tasks,
      sessions: [], 
      metrics,
      last_saved: new Date().toISOString(),
    };
  }

  /**
   * Calculates average completion time across all completed tasks
   * 
   * @private
   * @returns Average completion time in milliseconds
   */
  private calculateAverageCompletionTime(): number {
    const completedTasks = Array.from(this.tasks.values()).filter((t) => t.status === "completed");

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const duration = new Date(task.updated_at).getTime() - new Date(task.created_at).getTime();
      return sum + duration;
    }, 0);

    return Math.round(totalTime / completedTasks.length);
  }

  /**
   * Creates a new task or updates existing one
   * 
   * @param task - The task to create
   * @param sessionId - Optional session ID for notifications
   * 
   * @remarks
   * If a task with the same ID already exists, it will be updated instead of created.
   * This method emits a 'task:created' event and sends MCP notifications.
   * 
   * @example
   * ```typescript
   * await store.createTask({
   *   id: 'task-123',
   *   description: 'Build user dashboard',
   *   status: 'pending',
   *   created_at: new Date().toISOString(),
   *   updated_at: new Date().toISOString(),
   *   logs: []
   * });
   * ```
   */
  async createTask(task: Task, sessionId?: string): Promise<void> {
    const existing = this.tasks.get(task.id);
    if (existing) {
      logger.warn(`[TaskStore] Task ${task.id} already exists. Updating instead of creating.`);
      await this.updateTask(task.id, task, sessionId);
      return;
    }
    
    this.tasks.set(task.id, task);
    await this.persistence.saveTask(task);
    (this as TypedTaskStoreEmitter).emit("task:created", task);

    await sendResourcesListChangedNotification(sessionId);
    await sendResourcesUpdatedNotification(`task://${task.id}`, sessionId);
  }

  /**
   * Retrieves a task by ID
   * 
   * @param taskId - The ID of the task to retrieve
   * @returns The task if found, null otherwise
   * 
   * @example
   * ```typescript
   * const task = await store.getTask('task-123');
   * if (task) {
   *   console.log(task.description);
   * }
   * ```
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Updates an existing task with partial updates
   * 
   * @param taskId - The ID of the task to update
   * @param updates - Partial task updates to apply
   * @param sessionId - Optional session ID for notifications
   * @returns The updated task if found, null otherwise
   * 
   * @remarks
   * The updated_at timestamp is automatically set to the current time.
   * This method emits a 'task:updated' event and sends MCP notifications.
   * 
   * @example
   * ```typescript
   * const updated = await store.updateTask('task-123', {
   *   status: 'completed',
   *   output: 'Dashboard implementation complete'
   * });
   * ```
   */
  async updateTask(
    taskId: string,
    updates: Partial<Task>,
    sessionId?: string,
  ): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask = {
      ...task,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.tasks.set(taskId, updatedTask);
    await this.persistence.saveTask(updatedTask);
    (this as TypedTaskStoreEmitter).emit("task:updated", updatedTask);

    await sendResourcesUpdatedNotification(`task://${taskId}`, sessionId);

    return updatedTask;
  }

  /**
   * Retrieves tasks with optional filtering
   * 
   * @param filter - Optional filter criteria
   * @returns Array of tasks sorted by creation date (newest first)
   * 
   * @example
   * ```typescript
   * // Get all tasks
   * const allTasks = await store.getTasks();
   * 
   * // Get only completed tasks
   * const completedTasks = await store.getTasks({ status: 'completed' });
   * 
   * // Get tasks assigned to a specific session
   * const sessionTasks = await store.getTasks({ assigned_to: 'session-123' });
   * ```
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
      if (filter.assigned_to !== undefined) {
        tasks = tasks.filter((t) => t.assigned_to === filter.assigned_to);
      }
    }

    return tasks.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  /**
   * Adds a log entry to a task
   * 
   * @param taskId - The ID of the task to add the log to
   * @param log - The log message or entry to add
   * @param sessionId - Optional session ID for notifications
   * 
   * @remarks
   * Log entries can be either a string message or a structured TaskLogEntry.
   * String messages are converted to TaskLogEntry with 'info' level and 'system' type.
   * This method emits a 'task:log' event and sends MCP notifications.
   * 
   * @example
   * ```typescript
   * // Add a simple log message
   * await store.addLog('task-123', 'Starting authentication implementation');
   * 
   * // Add a structured log entry
   * await store.addLog('task-123', {
   *   timestamp: new Date().toISOString(),
   *   level: 'error',
   *   type: 'tool',
   *   message: 'Failed to connect to database',
   *   metadata: { error: 'Connection timeout' }
   * });
   * ```
   */
  async addLog(taskId: string, log: string | TaskLogEntry, sessionId?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      const logEntry: TaskLogEntry = typeof log === 'string' ? {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'system',
        message: log,
      } : log;

      const updatedTask = {
        ...task,
        logs: [...task.logs, logEntry],
        updated_at: new Date().toISOString()
      };
      this.tasks.set(taskId, updatedTask);
      await this.persistence.saveTask(updatedTask);
      (this as TypedTaskStoreEmitter).emit("task:log", { taskId, log: logEntry });

      await sendResourcesUpdatedNotification(`task://${taskId}`, sessionId);
    }
  }

  /**
   * Updates elapsed time for a task
   * 
   * @param taskId - The ID of the task to update
   * @param elapsedSeconds - The elapsed time in seconds
   * @param sessionId - Optional session ID for notifications
   * 
   * @remarks
   * This method emits a 'task:progress' event and sends MCP notifications.
   * The elapsed time is typically used for tracking agent execution duration.
   * 
   * @example
   * ```typescript
   * await store.updateElapsedTime('task-123', 300); // 5 minutes
   * ```
   */
  async updateElapsedTime(
    taskId: string,
    elapsedSeconds: number,
    sessionId?: string,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      const updatedTask = {
        ...task,
        updated_at: new Date().toISOString()
      };
      this.tasks.set(taskId, updatedTask);
      await this.persistence.saveTask(updatedTask);
      (this as TypedTaskStoreEmitter).emit("task:progress", { taskId, elapsed_seconds: elapsedSeconds });

      await sendResourcesUpdatedNotification(`task://${taskId}`, sessionId);
    }
  }

  /**
   * Deletes a task from the store
   * 
   * @param taskId - The ID of the task to delete
   * 
   * @remarks
   * This method removes the task from memory and disk storage.
   * It emits a 'task:deleted' event and sends MCP notifications.
   * 
   * @example
   * ```typescript
   * await store.deleteTask('task-123');
   * ```
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      await this.persistence.deleteTask(taskId);
      await this.persistState();
      (this as TypedTaskStoreEmitter).emit("task:deleted", { taskId });
      await sendResourcesListChangedNotification();
    }
  }

  /**
   * Retrieves all tasks sorted by creation date
   * 
   * @returns Array of all tasks sorted by creation date (newest first)
   * 
   * @example
   * ```typescript
   * const tasks = await store.getAllTasks();
   * console.log(`Total tasks: ${tasks.length}`);
   * ```
   */
  async getAllTasks(): Promise<Task[]> {
    return this.getTasks();
  }

  /**
   * Retrieves logs for a specific task
   * 
   * @param taskId - The ID of the task
   * @returns Array of log entries for the task
   * 
   * @example
   * ```typescript
   * const logs = await store.getTaskLogs('task-123');
   * logs.forEach(log => {
   *   console.log(`[${log.level}] ${log.message}`);
   * });
   * ```
   */
  async getTaskLogs(taskId: string): Promise<TaskLogEntry[]> {
    const task = this.tasks.get(taskId);
    return task ? task.logs : [];
  }

  /**
   * Alias for getTaskLogs
   * 
   * @param taskId - The ID of the task
   * @returns Array of log entries for the task
   * @see {@link getTaskLogs}
   */
  async getLogs(taskId: string): Promise<TaskLogEntry[]> {
    return this.getTaskLogs(taskId);
  }
}