/**
 * @fileoverview Unified Task type definitions
 * @module types/task
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
 */
export interface TaskLogEntry {
  /**
   * ISO timestamp of the log entry
   */
  timestamp: string;
  
  /**
   * Log severity level
   */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /**
   * Type of log entry
   */
  type: 'system' | 'agent' | 'tool' | 'output' | 'progress';
  
  /**
   * Optional prefix for categorizing logs
   */
  prefix?: string;
  
  /**
   * Log message content
   */
  message: string;
  
  /**
   * Additional metadata for the log entry
   */
  metadata?: {
    /**
     * Source of the log
     */
    source?: string;
    
    /**
     * Name of the tool if type is 'tool'
     */
    toolName?: string;
    
    /**
     * Tool input parameters
     */
    toolInput?: any;
    
    /**
     * Tool output result
     */
    toolOutput?: any;
    
    /**
     * File name for file-related logs
     */
    fileName?: string;
    
    /**
     * Line number for code-related logs
     */
    lineNumber?: number;
    
    /**
     * Operation duration in milliseconds
     */
    duration?: number;
    
    /**
     * Error details
     */
    error?: any;
    
    /**
     * Additional metadata fields
     */
    [key: string]: any;
  };
}

// ==================== Base Enums ====================

/**
 * Zod schema for task status values
 */
export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "waiting",          // Task completed but session still active for updates
  "completed",        // Task completed and session terminated
  "failed",
  "cancelled",
]);

/**
 * Task execution status
 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Zod schema for available AI tools
 */
export const AIToolSchema = z.enum(["CLAUDECODE"]);

/**
 * Available AI tools for task execution
 */
export type AITool = z.infer<typeof AIToolSchema>;

/**
 * Zod schema for task types
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
 */
export type TaskType = z.infer<typeof TaskTypeSchema>;

// ==================== Branded Types ====================

/**
 * Branded type for task identifiers
 */
export type TaskId = string & { readonly __brand: "TaskId" };

/**
 * Creates a branded TaskId from a string
 * @param {string} id - Task identifier string
 * @returns {TaskId} Branded task ID
 */
export const createTaskId = (id: string): TaskId => id as TaskId;

// ==================== Core Task Interface ====================

/**
 * Tool invocation details
 * @interface
 */
export interface ToolInvocation {
  /**
   * Unique identifier for this tool invocation
   */
  id: string;
  
  /**
   * Name of the tool
   */
  toolName: string;
  
  /**
   * ISO timestamp when tool was invoked
   */
  startTime: string;
  
  /**
   * ISO timestamp when tool completed
   */
  endTime?: string;
  
  /**
   * Duration in milliseconds
   */
  duration?: number;
  
  /**
   * Tool input parameters (strongly typed, no stringified JSON)
   */
  parameters: Record<string, any>;
  
  /**
   * Tool result (strongly typed, no stringified JSON)
   */
  result?: any;
  
  /**
   * Whether the tool invocation was successful
   */
  success?: boolean;
  
  /**
   * Error message if tool failed
   */
  error?: string;
}

/**
 * Summary of tool usage in a task
 * @interface
 */
export interface ToolUsageSummary {
  /**
   * Total number of tool invocations
   */
  totalInvocations: number;
  
  /**
   * Number of successful invocations
   */
  successfulInvocations: number;
  
  /**
   * Number of failed invocations
   */
  failedInvocations: number;
  
  /**
   * Tool invocation counts by tool name
   */
  byTool: Record<string, number>;
  
  /**
   * Most used tools (top 5)
   */
  mostUsedTools: Array<{
    toolName: string;
    count: number;
  }>;
  
  /**
   * Total duration spent in tool execution (ms)
   */
  totalDuration: number;
}

/**
 * Claude execution metrics
 * @interface
 */
export interface ClaudeMetrics {
  /**
   * Claude session ID
   */
  sessionId: string;
  
  /**
   * Process ID of Claude execution
   */
  pid?: number;
  
  /**
   * Execution duration in milliseconds
   */
  duration: number;
  
  /**
   * API duration in milliseconds
   */
  apiDuration?: number;
  
  /**
   * Number of turns/iterations
   */
  turns: number;
  
  /**
   * Exit code (0 for success)
   */
  exitCode?: number;
  
  /**
   * Token usage
   */
  usage: {
    /**
     * Input tokens consumed
     */
    inputTokens: number;
    
    /**
     * Output tokens generated
     */
    outputTokens: number;
    
    /**
     * Cache creation tokens
     */
    cacheCreationTokens: number;
    
    /**
     * Cache read tokens
     */
    cacheReadTokens: number;
    
    /**
     * Total tokens
     */
    totalTokens: number;
  };
  
  /**
   * Cost in USD
   */
  cost: number;
  
  /**
   * Service tier used
   */
  serviceTier?: string;
  
  /**
   * Whether execution was successful
   */
  success: boolean;
  
  /**
   * The final result message from Claude
   */
  resultMessage?: string;
}

/**
 * Core Task interface - comprehensive and complete
 * @interface
 */
export interface Task {
  /**
   * Unique task identifier
   */
  readonly id: TaskId;
  
  /**
   * Task description
   */
  readonly description: string;
  
  /**
   * Current task status
   */
  readonly status: TaskStatus;
  
  /**
   * AI tool assigned to execute the task
   */
  readonly tool: AITool;
  
  /**
   * ISO timestamp when task was created
   */
  readonly created_at: string;
  
  /**
   * ISO timestamp when task was last updated
   */
  readonly updated_at: string;
  
  /**
   * ISO timestamp when task execution started
   */
  readonly started_at?: string;
  
  /**
   * ISO timestamp when task completed
   */
  readonly completed_at?: string;
  
  /**
   * User or agent assigned to the task
   */
  readonly assigned_to?: string;
  
  /**
   * Error message if task failed
   */
  readonly error?: string;
  
  /**
   * Structured task result (never stringified JSON)
   */
  readonly result?: {
    /**
     * The final output/result text
     */
    output: string;
    
    /**
     * Whether the task was successful
     */
    success: boolean;
    
    /**
     * Error message if failed
     */
    error?: string;
    
    /**
     * Additional result data
     */
    data?: any;
  };
  
  /**
   * Execution log entries
   */
  readonly logs: TaskLogEntry[];
  
  /**
   * All tool invocations during task execution
   */
  readonly toolInvocations?: ToolInvocation[];
  
  /**
   * Tool usage summary
   */
  readonly toolUsageSummary?: ToolUsageSummary;
  
  /**
   * Claude execution metrics
   */
  readonly claudeMetrics?: ClaudeMetrics;
  
  /**
   * Files created or modified during task
   */
  readonly filesAffected?: Array<{
    path: string;
    operation: 'created' | 'modified' | 'deleted' | 'read';
    timestamp: string;
  }>;
  
  /**
   * Commands executed during task
   */
  readonly commandsExecuted?: Array<{
    command: string;
    exitCode: number;
    duration: number;
    timestamp: string;
  }>;
}

// ==================== Task Schema for Validation ====================

/**
 * Zod schema for task validation
 */
export const TaskSchema = z.object({
  id: z.string(),
  description: z.string().min(1).max(2555),
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
 */
export type ValidatedTask = z.infer<typeof TaskSchema>;

// ==================== Task Result ====================

/**
 * Task execution result
 * @interface
 */
export interface TaskResult {
  /**
   * Whether the task completed successfully
   */
  readonly success: boolean;
  
  /**
   * Task output data
   */
  readonly output?: unknown;
  
  /**
   * Error message if task failed
   */
  readonly error?: string;
}

// ==================== Task Creation & Update ====================

/**
 * Parameters for creating a new task
 * @interface
 */
export interface CreateTaskParams {
  /**
   * Task description
   */
  description: string;
  
  /**
   * AI tool to use for the task
   */
  tool: AITool;
}

/**
 * Parameters for updating an existing task
 * @interface
 */
export interface UpdateTaskParams {
  /**
   * New task status
   */
  status?: TaskStatus;
  
  /**
   * Task start timestamp
   */
  started_at?: string;
  
  /**
   * Task completion timestamp
   */
  completed_at?: string;
  
  /**
   * Assigned user or agent
   */
  assigned_to?: string;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Task result data
   */
  result?: Task['result'];
}

// ==================== Process Task for Execution ====================

/**
 * Extended task interface for process execution
 * @interface
 * @extends {Task}
 */
export interface ProcessTask extends Task {
  /**
   * Session ID for the task execution
   */
  readonly sessionId: SessionId;
  
  /**
   * Type of task to execute
   */
  readonly type: TaskType;
  
  /**
   * Project path for file operations
   */
  readonly projectPath: string;
  
  /**
   * Parent task ID for subtasks
   */
  readonly parentTaskId?: TaskId;
  
  /**
   * Additional task metadata
   */
  readonly metadata?: Record<string, unknown>;
  
  /**
   * Detailed task instructions
   */
  readonly instructions?: string;
  
  /**
   * Custom system prompt
   */
  readonly systemPrompt?: string;
}

/**
 * Parameters for creating a process task
 * @interface
 */
export interface ProcessTaskParams {
  /**
   * Optional task ID (auto-generated if not provided)
   */
  id?: TaskId;
  
  /**
   * Task description (derived from instructions if not provided)
   */
  description?: string;
  
  /**
   * AI tool to use
   */
  tool: AITool;
  
  /**
   * Session ID for execution
   */
  sessionId: SessionId;
  
  /**
   * Type of task
   */
  type: TaskType;
  
  /**
   * Project path (defaults to empty string)
   */
  projectPath?: string;
  
  /**
   * Parent task ID for subtasks
   */
  parentTaskId?: TaskId;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Task instructions
   */
  instructions?: string;
  
  /**
   * Custom system prompt
   */
  systemPrompt?: string;
}

// ==================== Task Management ====================

/**
 * Filter criteria for querying tasks
 * @interface
 */
export interface TaskFilter {
  /**
   * Filter by task status(es)
   */
  readonly status?: TaskStatus | TaskStatus[];
  
  /**
   * Filter by AI tool(s)
   */
  readonly tool?: AITool | AITool[];
  
  /**
   * Filter by assigned user/agent
   */
  readonly assignedTo?: string;
  
  /**
   * Filter tasks created after this timestamp
   */
  readonly createdAfter?: string;
  
  /**
   * Filter tasks created before this timestamp
   */
  readonly createdBefore?: string;
  
  /**
   * Search query for task descriptions
   */
  readonly search?: string;
}

/**
 * Statistical summary of tasks
 * @interface
 */
export interface TaskStats {
  /**
   * Total number of tasks
   */
  readonly total: number;
  
  /**
   * Task count grouped by status
   */
  readonly byStatus: Record<TaskStatus, number>;
  
  /**
   * Task count grouped by tool
   */
  readonly byTool: Record<AITool, number>;
  
  /**
   * Average task duration in milliseconds
   */
  readonly averageDuration: number;
  
  /**
   * Success rate as a percentage (0-100)
   */
  readonly successRate: number;
}

// ==================== Type Guards ====================

/**
 * Type guard to check if value is a Task
 * @param {unknown} value - Value to check
 * @returns {value is Task} True if value is a valid Task
 */
export function isTask(value: unknown): value is Task {
  return TaskSchema.safeParse(value).success;
}

/**
 * Type guard to check if value is a ProcessTask
 * @param {unknown} value - Value to check
 * @returns {value is ProcessTask} True if value is a valid ProcessTask
 */
export function isProcessTask(value: unknown): value is ProcessTask {
  return isTask(value) && "sessionId" in value && "type" in value && "projectPath" in value;
}

// ==================== Type Converters ====================

/**
 * Creates a new Task from parameters
 * @param {CreateTaskParams} params - Task creation parameters
 * @returns {Task} Created task
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
