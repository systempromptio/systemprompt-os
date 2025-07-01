/**
 * @fileoverview Unified Task type definitions
 * @module types/task
 * @since 1.0.0
 *
 * @remarks
 * This is the single source of truth for all Task-related types in the application.
 * Modern, slim, and type-safe with no backwards compatibility cruft.
 */

import { z } from "zod";
import type { SessionId } from "./core/session.js";

// ==================== Log Entry Types ====================

/**
 * Task log entry for tracking execution progress
 * @interface
 * @since 1.0.0
 */
export interface TaskLogEntry {
  /**
   * ISO timestamp of the log entry
   * @since 1.0.0
   */
  timestamp: string;
  
  /**
   * Log severity level
   * @since 1.0.0
   */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /**
   * Type of log entry
   * @since 1.0.0
   */
  type: 'system' | 'agent' | 'tool' | 'output' | 'progress';
  
  /**
   * Optional prefix for categorizing logs
   * @since 1.0.0
   */
  prefix?: string;
  
  /**
   * Log message content
   * @since 1.0.0
   */
  message: string;
  
  /**
   * Additional metadata for the log entry
   * @since 1.0.0
   */
  metadata?: {
    /**
     * Source of the log
     * @since 1.0.0
     */
    source?: string;
    
    /**
     * Name of the tool if type is 'tool'
     * @since 1.0.0
     */
    toolName?: string;
    
    /**
     * Tool input parameters
     * @since 1.0.0
     */
    toolInput?: any;
    
    /**
     * Tool output result
     * @since 1.0.0
     */
    toolOutput?: any;
    
    /**
     * File name for file-related logs
     * @since 1.0.0
     */
    fileName?: string;
    
    /**
     * Line number for code-related logs
     * @since 1.0.0
     */
    lineNumber?: number;
    
    /**
     * Operation duration in milliseconds
     * @since 1.0.0
     */
    duration?: number;
    
    /**
     * Error details
     * @since 1.0.0
     */
    error?: any;
    
    /**
     * Additional metadata fields
     * @since 1.0.0
     */
    [key: string]: any;
  };
}

// ==================== Base Enums ====================

/**
 * Zod schema for task status values
 * @since 1.0.0
 */
export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed_active", // Task completed but session still active for updates
  "completed",        // Task completed and session terminated
  "failed",
  "cancelled",
]);

/**
 * Task execution status
 * @since 1.0.0
 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Zod schema for available AI tools
 * @since 1.0.0
 */
export const AIToolSchema = z.enum(["CLAUDECODE"]);

/**
 * Available AI tools for task execution
 * @since 1.0.0
 */
export type AITool = z.infer<typeof AIToolSchema>;

/**
 * Zod schema for task types
 * @since 1.0.0
 */
export const TaskTypeSchema = z.enum([
  "query",
  "code_generation",
  "code_review",
  "refactoring",
  "testing",
  "documentation",
  "custom",
]);

/**
 * Types of tasks that can be executed
 * @since 1.0.0
 */
export type TaskType = z.infer<typeof TaskTypeSchema>;

// ==================== Branded Types ====================

/**
 * Branded type for task identifiers
 * @since 1.0.0
 */
export type TaskId = string & { readonly __brand: "TaskId" };

/**
 * Creates a branded TaskId from a string
 * @param {string} id - Task identifier string
 * @returns {TaskId} Branded task ID
 * @since 1.0.0
 */
export const createTaskId = (id: string): TaskId => id as TaskId;

// ==================== Core Task Interface ====================

/**
 * Core Task interface - slim and focused
 * @interface
 * @since 1.0.0
 */
export interface Task {
  /**
   * Unique task identifier
   * @since 1.0.0
   */
  readonly id: TaskId;
  
  /**
   * Task description
   * @since 1.0.0
   */
  readonly description: string;
  
  /**
   * Current task status
   * @since 1.0.0
   */
  readonly status: TaskStatus;
  
  /**
   * AI tool assigned to execute the task
   * @since 1.0.0
   */
  readonly tool: AITool;
  
  /**
   * ISO timestamp when task was created
   * @since 1.0.0
   */
  readonly created_at: string;
  
  /**
   * ISO timestamp when task was last updated
   * @since 1.0.0
   */
  readonly updated_at: string;
  
  /**
   * ISO timestamp when task execution started
   * @since 1.0.0
   */
  readonly started_at?: string;
  
  /**
   * ISO timestamp when task completed
   * @since 1.0.0
   */
  readonly completed_at?: string;
  
  /**
   * User or agent assigned to the task
   * @since 1.0.0
   */
  readonly assigned_to?: string;
  
  /**
   * Error message if task failed
   * @since 1.0.0
   */
  readonly error?: string;
  
  /**
   * Task execution result
   * @since 1.0.0
   */
  readonly result?: unknown;
  
  /**
   * Execution log entries
   * @since 1.0.0
   */
  readonly logs: TaskLogEntry[];
}

// ==================== Task Schema for Validation ====================

/**
 * Zod schema for task validation
 * @since 1.0.0
 */
export const TaskSchema = z.object({
  id: z.string(),
  description: z.string().min(1).max(5000),
  status: TaskStatusSchema,
  tool: AIToolSchema,
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  assigned_to: z.string().optional(),
  error: z.string().optional(),
  result: z.unknown().optional(),
  logs: z.array(z.object({
    timestamp: z.string(),
    level: z.enum(['debug', 'info', 'warn', 'error']),
    type: z.enum(['system', 'agent', 'tool', 'output', 'progress']),
    prefix: z.string().optional(),
    message: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  })).default([]),
});

/**
 * Validated task type from Zod schema
 * @since 1.0.0
 */
export type ValidatedTask = z.infer<typeof TaskSchema>;

// ==================== Task Result ====================

/**
 * Task execution result
 * @interface
 * @since 1.0.0
 */
export interface TaskResult {
  /**
   * Whether the task completed successfully
   * @since 1.0.0
   */
  readonly success: boolean;
  
  /**
   * Task output data
   * @since 1.0.0
   */
  readonly output?: unknown;
  
  /**
   * Error message if task failed
   * @since 1.0.0
   */
  readonly error?: string;
}

// ==================== Task Creation & Update ====================

/**
 * Parameters for creating a new task
 * @interface
 * @since 1.0.0
 */
export interface CreateTaskParams {
  /**
   * Task description
   * @since 1.0.0
   */
  description: string;
  
  /**
   * AI tool to use for the task
   * @since 1.0.0
   */
  tool: AITool;
}

/**
 * Parameters for updating an existing task
 * @interface
 * @since 1.0.0
 */
export interface UpdateTaskParams {
  /**
   * New task status
   * @since 1.0.0
   */
  status?: TaskStatus;
  
  /**
   * Task start timestamp
   * @since 1.0.0
   */
  started_at?: string;
  
  /**
   * Task completion timestamp
   * @since 1.0.0
   */
  completed_at?: string;
  
  /**
   * Assigned user or agent
   * @since 1.0.0
   */
  assigned_to?: string;
  
  /**
   * Error message
   * @since 1.0.0
   */
  error?: string;
  
  /**
   * Task result data
   * @since 1.0.0
   */
  result?: unknown;
}

// ==================== Process Task for Execution ====================

/**
 * Extended task interface for process execution
 * @interface
 * @extends {Task}
 * @since 1.0.0
 */
export interface ProcessTask extends Task {
  /**
   * Session ID for the task execution
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Type of task to execute
   * @since 1.0.0
   */
  readonly type: TaskType;
  
  /**
   * Project path for file operations
   * @since 1.0.0
   */
  readonly projectPath: string;
  
  /**
   * Parent task ID for subtasks
   * @since 1.0.0
   */
  readonly parentTaskId?: TaskId;
  
  /**
   * Additional task metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
  
  /**
   * Detailed task instructions
   * @since 1.0.0
   */
  readonly instructions?: string;
  
  /**
   * Custom system prompt
   * @since 1.0.0
   */
  readonly systemPrompt?: string;
}

/**
 * Parameters for creating a process task
 * @interface
 * @since 1.0.0
 */
export interface ProcessTaskParams {
  /**
   * Optional task ID (auto-generated if not provided)
   * @since 1.0.0
   */
  id?: TaskId;
  
  /**
   * Task description (derived from instructions if not provided)
   * @since 1.0.0
   */
  description?: string;
  
  /**
   * AI tool to use
   * @since 1.0.0
   */
  tool: AITool;
  
  /**
   * Session ID for execution
   * @since 1.0.0
   */
  sessionId: SessionId;
  
  /**
   * Type of task
   * @since 1.0.0
   */
  type: TaskType;
  
  /**
   * Project path (defaults to empty string)
   * @since 1.0.0
   */
  projectPath?: string;
  
  /**
   * Parent task ID for subtasks
   * @since 1.0.0
   */
  parentTaskId?: TaskId;
  
  /**
   * Additional metadata
   * @since 1.0.0
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Task instructions
   * @since 1.0.0
   */
  instructions?: string;
  
  /**
   * Custom system prompt
   * @since 1.0.0
   */
  systemPrompt?: string;
}

// ==================== Task Management ====================

/**
 * Filter criteria for querying tasks
 * @interface
 * @since 1.0.0
 */
export interface TaskFilter {
  /**
   * Filter by task status(es)
   * @since 1.0.0
   */
  readonly status?: TaskStatus | TaskStatus[];
  
  /**
   * Filter by AI tool(s)
   * @since 1.0.0
   */
  readonly tool?: AITool | AITool[];
  
  /**
   * Filter by assigned user/agent
   * @since 1.0.0
   */
  readonly assignedTo?: string;
  
  /**
   * Filter tasks created after this timestamp
   * @since 1.0.0
   */
  readonly createdAfter?: string;
  
  /**
   * Filter tasks created before this timestamp
   * @since 1.0.0
   */
  readonly createdBefore?: string;
  
  /**
   * Search query for task descriptions
   * @since 1.0.0
   */
  readonly search?: string;
}

/**
 * Statistical summary of tasks
 * @interface
 * @since 1.0.0
 */
export interface TaskStats {
  /**
   * Total number of tasks
   * @since 1.0.0
   */
  readonly total: number;
  
  /**
   * Task count grouped by status
   * @since 1.0.0
   */
  readonly byStatus: Record<TaskStatus, number>;
  
  /**
   * Task count grouped by tool
   * @since 1.0.0
   */
  readonly byTool: Record<AITool, number>;
  
  /**
   * Average task duration in milliseconds
   * @since 1.0.0
   */
  readonly averageDuration: number;
  
  /**
   * Success rate as a percentage (0-100)
   * @since 1.0.0
   */
  readonly successRate: number;
}

// ==================== Type Guards ====================

/**
 * Type guard to check if value is a Task
 * @param {unknown} value - Value to check
 * @returns {value is Task} True if value is a valid Task
 * @since 1.0.0
 */
export function isTask(value: unknown): value is Task {
  return TaskSchema.safeParse(value).success;
}

/**
 * Type guard to check if value is a ProcessTask
 * @param {unknown} value - Value to check
 * @returns {value is ProcessTask} True if value is a valid ProcessTask
 * @since 1.0.0
 */
export function isProcessTask(value: unknown): value is ProcessTask {
  return isTask(value) && "sessionId" in value && "type" in value && "projectPath" in value;
}

// ==================== Type Converters ====================

/**
 * Creates a new Task from parameters
 * @param {CreateTaskParams} params - Task creation parameters
 * @returns {Task} Created task
 * @since 1.0.0
 */
export function createTask(params: CreateTaskParams): Task {
  const now = new Date().toISOString();
  return {
    id: createTaskId(`task_${Date.now()}`),
    description: params.description,
    tool: params.tool,
    status: "pending",
    created_at: now,
    updated_at: now,
    logs: [],
  };
}

/**
 * Creates a new ProcessTask from parameters
 * @param {ProcessTaskParams} params - Process task creation parameters
 * @returns {ProcessTask} Created process task
 * @since 1.0.0
 */
export function createProcessTask(params: ProcessTaskParams): ProcessTask {
  const now = new Date().toISOString();
  const id =
    params.id || createTaskId(`task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  return {
    id,
    description:
      params.description || (params.instructions ? params.instructions.substring(0, 200) : "Task"),
    status: "pending",
    tool: params.tool,
    created_at: now,
    updated_at: now,
    logs: [],
    sessionId: params.sessionId,
    type: params.type,
    projectPath: params.projectPath || "",
    parentTaskId: params.parentTaskId,
    metadata: params.metadata,
    instructions: params.instructions,
    systemPrompt: params.systemPrompt,
  };
}
