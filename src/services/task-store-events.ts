import type { Task, TaskLogEntry } from "../types/task.js";

/**
 * Type-safe event map for TaskStore
 */
export interface TaskStoreEventMap {
  "task:created": (task: Task) => void;
  "task:updated": (task: Task) => void;
  "task:deleted": (data: { taskId: string }) => void;
  "task:log": (data: { taskId: string; log: TaskLogEntry }) => void;
  "task:progress": (data: { taskId: string; elapsed_seconds: number }) => void;
}

/**
 * Type-safe event emitter for TaskStore
 */
export interface TypedTaskStoreEmitter {
  on<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;

  emit<K extends keyof TaskStoreEventMap>(
    event: K,
    ...args: Parameters<TaskStoreEventMap[K]>
  ): boolean;

  off<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;

  once<K extends keyof TaskStoreEventMap>(
    event: K,
    listener: TaskStoreEventMap[K]
  ): this;
}