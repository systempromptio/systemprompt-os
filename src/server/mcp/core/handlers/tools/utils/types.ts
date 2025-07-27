/**
 * @file Orchestrator tool type definitions and schemas.
 * @description Type definitions and schemas for orchestrator tool operations including task management, status checking, and error handling.
 * @module handlers/tools/orchestrator/utils/types
 */

import { z } from "zod";
import type { ITask } from '@/server/mcp/core/types/task';

/**
 * Schema for create task arguments.
 */
export const CreateTaskArgsSchema = z.object({
  title: z.string().min(1)
.max(255),
  instructions: z.string().min(1)
.max(10000),
});
/**
 * Type for create task arguments.
 */
export type CreateTaskArgs = z.infer<typeof CreateTaskArgsSchema>;

/**
 * Schema for update task arguments.
 */
export const UpdateTaskArgsSchema = z.object({
  id: z.string(),
  instructions: z.string().min(1)
.max(10000),
});
/**
 * Type for update task arguments.
 */
export type UpdateTaskArgs = z.infer<typeof UpdateTaskArgsSchema>;

/**
 * Schema for end task arguments.
 */
export const EndTaskArgsSchema = z.object({
  id: z.string(),
});
/**
 * Type for end task arguments.
 */
export type EndTaskArgs = z.infer<typeof EndTaskArgsSchema>;

/**
 * Schema for report task arguments.
 */
export const ReportTaskArgsSchema = z.object({
  id: z.string().optional(),
});
/**
 * Type for report task arguments.
 */
export type ReportTaskArgs = z.infer<typeof ReportTaskArgsSchema>;

/**
 * Schema for clean state arguments.
 */
export const CleanStateArgsSchema = z.object({});
/**
 * Type for clean state arguments.
 */
export type CleanStateArgs = z.infer<typeof CleanStateArgsSchema>;

/**
 * Schema for check status arguments.
 */
export const CheckStatusArgsSchema = z.object({});
/**
 * Type for check status arguments.
 */
export type CheckStatusArgs = z.infer<typeof CheckStatusArgsSchema>;

/**
 * System status enumeration.
 */
export const enum SystemStatusEnum {
  ACTIVE = "active",
  PARTIAL = "partial",
  NOTACTIVE = "notactive"
}

/**
 * Service status enumeration.
 */
export const enum ServiceStatusEnum {
  ACTIVE = "active",
  NOTACTIVE = "notactive"
}

/**
 * Session status enumeration.
 */
export const enum SessionStatusEnum {
  ACTIVE = "active",
  BUSY = "busy",
  TERMINATED = "terminated"
}

/**
 * Task status enumeration.
 */
export const enum TaskStatusEnum {
  PENDING = "pending",
  INPROGRESS = "inprogress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

/**
 * Response structure for check status operation.
 */
export interface ICheckStatusResponse {
  status: SystemStatusEnum;
  services: {
    claude: {
      status: ServiceStatusEnum;
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
    status: SessionStatusEnum;
    taskId?: string;
  }>;
}

/**
 * Generic tool response structure.
 */
export interface IToolResponse<T = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly payload?: T;
  readonly error?: {
    readonly type: string;
    readonly details?: unknown;
  };
}

/**
 * Session context information.
 */
export interface ISessionContext {
  readonly sessionId?: string;
  readonly userId?: string;
  readonly requestId?: string;
}

/**
 * Validation error with field information.
 */
export class ValidationError extends Error {
  /**
   * Creates a validation error.
   * @param message - Error message.
   * @param field - Field that failed validation.
   * @param value - Value that failed validation.
   */
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
 * Task not found error.
 */
export class TaskNotFoundError extends Error {
  /**
   * Creates a task not found error.
   * @param taskId - ID of the task that was not found.
   */
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = "TaskNotFoundError";
  }
}

/**
 * Tool not available error.
 */
export class ToolNotAvailableError extends Error {
  /**
   * Creates a tool not available error.
   * @param tool - Name of the tool that is not available.
   */
  constructor(tool: string) {
    super(`Tool not available: ${tool}`);
    this.name = "ToolNotAvailableError";
  }
}

/**
 * Git operation error.
 */
export class GitOperationError extends Error {
  /**
   * Creates a git operation error.
   * @param operation - Git operation that failed.
   * @param details - Additional error details.
   */
  constructor(
    operation: string,
    public readonly details?: unknown,
  ) {
    super(`Git operation failed: ${operation}`);
    this.name = "GitOperationError";
  }
}

/**
 * Status check error.
 */
export class StatusCheckError extends Error {
  /**
   * Creates a status check error.
   * @param message - Error message.
   * @param details - Additional error details.
   */
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StatusCheckError";
  }
}

/**
 * Task report structure.
 */
export interface ITaskReport {
  readonly task: ITask;
  readonly duration: string;
  readonly logCount: number;
  readonly summary: string;
}
