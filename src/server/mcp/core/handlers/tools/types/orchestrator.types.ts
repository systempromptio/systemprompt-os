/**
 * Orchestrator tool type definitions and schemas.
 * Type definitions and schemas for orchestrator tool operations including
 * task management, status checking, and error handling.
 * @file Orchestrator tool type definitions and schemas.
 * @module handlers/tools/types/orchestrator
 */

import { z } from "zod";
import type { ITask } from '@/server/mcp/core/types/task';

/**
 * Schema for create task arguments.
 */
export const CreateTaskArgsSchema = z.object({
  title: z.string()
    .min(1)
    .max(255),
  instructions: z.string()
    .min(1)
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
  instructions: z.string()
    .min(1)
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
 * Task report structure.
 */
export interface ITaskReport {
  readonly task: ITask;
  readonly duration: string;
  readonly logCount: number;
  readonly summary: string;
}
