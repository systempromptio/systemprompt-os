/**
 * Task store service for managing task state and persistence
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

/**
 * Manages task state, persistence, and notifications
 */
export class TaskStore extends EventEmitter implements TypedTaskStoreEmitter {
  private static instance: TaskStore;
  private tasks: Map<string, Task> = new Map();
  private persistence: StatePersistence;

  private constructor() {
    super();
    this.persistence = StatePersistence.getInstance();
    this.loadPersistedTasks();

    /**
     * Auto-save state on task changes
     */
    (this as TypedTaskStoreEmitter).on("task:created", () => this.persistState());
    (this as TypedTaskStoreEmitter).on("task:updated", () => this.persistState());
  }

  /**
   * Gets singleton instance of TaskStore
   */
  static getInstance(): TaskStore {
    if (!TaskStore.instance) {
      TaskStore.instance = new TaskStore();
    }
    return TaskStore.instance;
  }

  /**
   * Loads persisted tasks from storage on startup
   */
  private async loadPersistedTasks(): Promise<void> {
    try {
      console.log(`[TaskStore] Loading persisted tasks from disk...`);
      const tasks = await this.persistence.loadTasks();
      console.log(`[TaskStore] Found ${tasks.length} task files on disk`);
      
      for (const task of tasks) {
        this.tasks.set(task.id, task);
        console.log(`[TaskStore] Loaded task: ${task.id} - ${task.description}`);
      }
      console.log(`[TaskStore] Loaded ${tasks.length} persisted tasks into memory`);
    } catch (error) {
      console.error("[TaskStore] Failed to load persisted tasks:", error);
    }
  }

  /**
   * Persists current state to storage
   */
  private async persistState(): Promise<void> {
    try {
      const state = await this.getState();
      await this.persistence.saveState(state);
    } catch (error) {
      console.error("Failed to persist state:", error);
    }
  }

  /**
   * Gets current application state including all tasks and metrics
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
   */
  async createTask(task: Task, sessionId?: string): Promise<void> {
    const existing = this.tasks.get(task.id);
    if (existing) {
      console.warn(`[TaskStore] Task ${task.id} already exists. Updating instead of creating.`);
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
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Updates an existing task with partial updates
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
   */
  async getAllTasks(): Promise<Task[]> {
    return this.getTasks();
  }

  /**
   * Retrieves logs for a specific task
   */
  async getTaskLogs(taskId: string): Promise<TaskLogEntry[]> {
    const task = this.tasks.get(taskId);
    return task ? task.logs : [];
  }

  /**
   * Alias for getTaskLogs
   */
  async getLogs(taskId: string): Promise<TaskLogEntry[]> {
    return this.getTaskLogs(taskId);
  }
}