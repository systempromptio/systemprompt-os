/**
 * @fileoverview Orchestrator tool type definitions and schemas
 * @module handlers/tools/orchestrator/utils/types
 */

import { z } from "zod";
import { Task } from "../../../types/task.js";

/**
 * Schema for create task arguments
 */
export const CreateTaskArgsSchema = z.object({
  instructions: z.string().min(1).max(10000),
});
export type CreateTaskArgs = z.infer<typeof CreateTaskArgsSchema>;

/**
 * Schema for update task arguments
 */
export const UpdateTaskArgsSchema = z.object({
  id: z.string(),
  instructions: z.string().min(1).max(10000),
});
export type UpdateTaskArgs = z.infer<typeof UpdateTaskArgsSchema>;

/**
 * Schema for end task arguments
 */
export const EndTaskArgsSchema = z.object({
  id: z.string(),
});
export type EndTaskArgs = z.infer<typeof EndTaskArgsSchema>;

/**
 * Schema for report task arguments
 */
export const ReportTaskArgsSchema = z.object({
  id: z.string().optional(),
});
export type ReportTaskArgs = z.infer<typeof ReportTaskArgsSchema>;

/**
 * Schema for clean state arguments
 */
export const CleanStateArgsSchema = z.object({});
export type CleanStateArgs = z.infer<typeof CleanStateArgsSchema>;

/**
 * Schema for check status arguments
 */
export const CheckStatusArgsSchema = z.object({});
export type CheckStatusArgs = z.infer<typeof CheckStatusArgsSchema>;

/**
 * System status enumeration
 */
export enum SystemStatus {
  ACTIVE = "active",
  PARTIAL = "partial",
  NOT_ACTIVE = "not_active"
}

/**
 * Service status enumeration
 */
export enum ServiceStatus {
  ACTIVE = "active",
  NOT_ACTIVE = "not_active"
}

/**
 * Session status enumeration
 */
export enum SessionStatus {
  ACTIVE = "active",
  BUSY = "busy",
  TERMINATED = "terminated"
}

/**
 * Task status enumeration
 */
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

/**
 * Response structure for check status operation
 */
export interface CheckStatusResponse {
  status: SystemStatus;
  services: {
    claude: {
      status: ServiceStatus;
      available: boolean;
    };
  };
  daemon: {
    connected: boolean;
    host: string;
    port: number;
  };
  tasks: {
    active: number;
    total: number;
  };
  sessions: {
    active: number;
    total: number;
  };
  processes: Array<{
    id: string;
    type: "claude";
    status: SessionStatus;
    taskId?: string;
  }>;
}

/**
 * Generic tool response structure
 */
export interface ToolResponse<T = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly data?: T;
  readonly error?: {
    readonly type: string;
    readonly details?: unknown;
  };
}

/**
 * Session context information
 */
export interface SessionContext {
  readonly sessionId?: string;
  readonly userId?: string;
  readonly requestId?: string;
}

/**
 * Validation error with field information
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Task not found error
 */
export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = "TaskNotFoundError";
  }
}

/**
 * Tool not available error
 */
export class ToolNotAvailableError extends Error {
  constructor(tool: string) {
    super(`Tool not available: ${tool}`);
    this.name = "ToolNotAvailableError";
  }
}

/**
 * Git operation error
 */
export class GitOperationError extends Error {
  constructor(
    operation: string,
    public readonly details?: unknown,
  ) {
    super(`Git operation failed: ${operation}`);
    this.name = "GitOperationError";
  }
}

/**
 * Status check error
 */
export class StatusCheckError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StatusCheckError";
  }
}

/**
 * Task report structure
 */
export interface TaskReport {
  readonly task: Task;
  readonly duration: string;
  readonly logCount: number;
  readonly summary: string;
}
