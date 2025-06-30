/**
 * @file Task management utilities for orchestrator tools
 * @module handlers/tools/orchestrator/utils/task
 */

import { v4 as uuidv4 } from "uuid";
import { TaskStore } from "../../../../services/task-store.js";
import { logger } from "../../../../utils/logger.js";
import type {
  Task,
  TaskStatus,
  AITool,
  createTaskId,
  UpdateTaskParams,
  TaskLogEntry,
} from "../../../../types/task.js";
import { TASK_STATUS } from "../../../../constants/task-status.js";

export interface TaskCreationParams {
  description: string;
  tool: AITool;
  projectPath: string;
}

export interface TaskReport {
  task: Task;
  duration: string;
  logCount: number;
  summary: string;
}

/**
 * High-level utilities for task management
 */
export class TaskOperations {
  public readonly taskStore: TaskStore;

  constructor(taskStore?: TaskStore) {
    this.taskStore = taskStore || TaskStore.getInstance();
  }

  /**
   * Creates a new task
   */
  async createTask(params: TaskCreationParams, sessionId?: string): Promise<Task> {
    // Use pure UUID as task ID - no prefix
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId as ReturnType<typeof createTaskId>,
      description: params.description,
      tool: params.tool,
      status: TASK_STATUS.PENDING,
      created_at: now,
      updated_at: now,
      logs: [],  // Start with empty logs array
    };

    await this.taskStore.createTask(task, sessionId);
    logger.info("Task created", { taskId, tool: params.tool });
    
    // Add initial log entry
    const logEntry: TaskLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'system',
      message: `Task created with ${params.tool} tool`,
      metadata: {
        tool: params.tool,
        taskId,
      }
    };
    await this.taskStore.addLog(taskId, logEntry, sessionId);

    return task;
  }

  /**
   * Updates task status with validation
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    sessionId?: string,
    metadata?: {
      error?: string;
      result?: unknown;
      completedAt?: string;
    },
  ): Promise<Task | null> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) {
      logger.warn("Task not found for status update", { taskId });
      return null;
    }

    // Validate state transitions
    if (!this.isValidStatusTransition(task.status, newStatus)) {
      logger.warn("Invalid status transition", {
        taskId,
        from: task.status,
        to: newStatus,
      });
      throw new Error(`Cannot transition from ${task.status} to ${newStatus}`);
    }

    // Build updates object based on status
    const updates: UpdateTaskParams = {
      status: newStatus,
    };

    // Add status-specific updates
    switch (newStatus) {
      case TASK_STATUS.IN_PROGRESS:
        if (!task.started_at) {
          updates.started_at = new Date().toISOString();
        }
        break;

      case TASK_STATUS.COMPLETED_ACTIVE:
        // Task is done but session remains active
        break;
        
      case TASK_STATUS.COMPLETED:
      case TASK_STATUS.FAILED:
      case TASK_STATUS.CANCELLED:
        if (!task.completed_at) {
          updates.completed_at = metadata?.completedAt || new Date().toISOString();
        }
        if (metadata?.error) {
          updates.error = metadata.error;
        }
        if (metadata?.result !== undefined) {
          updates.result = metadata.result;
        }
        break;
    }

    await this.taskStore.updateTask(taskId, updates, sessionId);
    
    const logEntry: TaskLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'system',
      message: `Status: ${newStatus}`,
      metadata: {
        previousStatus: task.status,
        newStatus,
        taskId,
      }
    };
    await this.taskStore.addLog(taskId, logEntry, sessionId);

    return { ...task, ...updates };
  }

  /**
   * Checks if a status transition is valid
   */
  private isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TASK_STATUS.PENDING]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.CANCELLED],
      [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED_ACTIVE, TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED],
      [TASK_STATUS.COMPLETED_ACTIVE]: [TASK_STATUS.COMPLETED],  // Can transition to fully completed when session ends
      [TASK_STATUS.COMPLETED]: [],
      [TASK_STATUS.FAILED]: [],
      [TASK_STATUS.CANCELLED]: [],
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Generates a task report
   */
  async generateTaskReport(
    taskId: string,
    format: "markdown" | "json" | "summary" = "markdown",
  ): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const logs = await this.taskStore.getLogs(taskId);
    const duration = this.calculateDuration(task);

    switch (format) {
      case "json":
        return JSON.stringify(
          {
            task,
            logs,
            duration,
            metrics: this.calculateTaskMetrics(task, logs),
          },
          null,
          2,
        );

      case "summary":
        return this.generateSummaryReport(task, logs, duration);

      case "markdown":
      default:
        return this.generateMarkdownReport(task, logs, duration);
    }
  }

  /**
   * Generates a markdown report
   */
  private generateMarkdownReport(task: Task, logs: TaskLogEntry[], duration: string): string {
    const status =
      task.status === TASK_STATUS.COMPLETED
        ? "✅"
        : task.status === TASK_STATUS.COMPLETED_ACTIVE
          ? "✅🔄"
          : task.status === TASK_STATUS.FAILED
            ? "❌"
            : task.status === TASK_STATUS.CANCELLED
              ? "⏹️"
              : task.status === TASK_STATUS.IN_PROGRESS
                ? "🔄"
                : "⏳";

    let report = `# Task Report\n\n`;
    report += `**ID:** ${task.id}\n`;
    report += `**Status:** ${status} ${task.status}\n`;
    report += `**Tool:** ${task.tool === "CLAUDECODE" ? "Claude Code" : "Gemini CLI"}\n`;
    report += `**Duration:** ${duration}\n`;
    report += `**Created:** ${new Date(task.created_at).toLocaleString()}\n`;

    if (task.started_at) {
      report += `**Started:** ${new Date(task.started_at).toLocaleString()}\n`;
    }

    if (task.completed_at) {
      report += `**Completed:** ${new Date(task.completed_at).toLocaleString()}\n`;
    }

    report += `\n## Description\n\n${task.description}\n`;

    if (task.error) {
      report += `\n## Error\n\n\`\`\`\n${task.error}\n\`\`\`\n`;
    }

    if (logs.length > 0) {
      report += `\n## Execution Logs (${logs.length} entries)\n\n`;
      report += "```\n";
      report += logs.slice(-50).map(log => {
        const prefix = log.prefix ? `[${log.prefix}]` : '';
        const level = log.level !== 'info' ? `[${log.level.toUpperCase()}]` : '';
        return `[${log.timestamp}] ${level}${prefix} ${log.message}`;
      }).join("\n");
      report += "\n```\n";
    }

    return report;
  }

  /**
   * Generates a summary report
   */
  private generateSummaryReport(task: Task, logs: TaskLogEntry[], duration: string): string {
    const errorCount = logs.filter((log) => log.level === 'error').length;
    const warningCount = logs.filter((log) => log.level === 'warn').length;

    return [
      `Task ID: ${task.id}`,
      `Status: ${task.status}`,
      `Duration: ${duration}`,
      `Logs: ${logs.length} entries (${errorCount} errors, ${warningCount} warnings)`,
      task.error ? `Error: ${task.error.substring(0, 100)}...` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Calculates task duration
   */
  private calculateDuration(task: Task): string {
    if (!task.started_at) {
      return "Not started";
    }

    const start = new Date(task.started_at).getTime();
    const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();

    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  /**
   * Calculates task metrics
   */
  private calculateTaskMetrics(task: Task, logs: TaskLogEntry[]): Record<string, unknown> {
    return {
      totalLogs: logs.length,
      errorCount: logs.filter((log) => log.level === 'error').length,
      warningCount: logs.filter((log) => log.level === 'warn').length,
      toolCalls: logs.filter((log) => log.type === 'tool').length,
      agentMessages: logs.filter((log) => log.type === 'agent').length,
      systemEvents: logs.filter((log) => log.type === 'system').length,
      outputLines: logs.filter((log) => log.type === 'output').length,
      status: task.status,
    };
  }

  /**
   * Updates a task
   */
  async updateTask(
    taskId: string,
    updates: Partial<Task>,
    sessionId?: string,
  ): Promise<Task | null> {
    return this.taskStore.updateTask(taskId, updates, sessionId);
  }

  /**
   * Adds a log entry
   */
  async addTaskLog(taskId: string, log: string | TaskLogEntry, sessionId?: string): Promise<void> {
    await this.taskStore.addLog(taskId, log, sessionId);
  }

  /**
   * Gets task statistics
   */
  async getTaskStatistics(): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byTool: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const tasks = await this.taskStore.getTasks();

    const byStatus = tasks.reduce(
      (acc: Record<TaskStatus, number>, task: Task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<TaskStatus, number>,
    );

    const byTool = tasks.reduce(
      (acc: Record<string, number>, task: Task) => {
        acc[task.tool] = (acc[task.tool] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const completedTasks = tasks.filter((t: Task) => t.status === TASK_STATUS.COMPLETED);
    const totalDuration = completedTasks.reduce((sum: number, task: Task) => {
      if (task.started_at && task.completed_at) {
        const start = new Date(task.started_at).getTime();
        const end = new Date(task.completed_at).getTime();
        return sum + Math.floor((end - start) / 1000);
      }
      return sum;
    }, 0);

    const successRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

    return {
      total: tasks.length,
      byStatus,
      byTool,
      averageDuration: completedTasks.length > 0 ? totalDuration / completedTasks.length : 0,
      successRate,
    };
  }
}

// Export singleton instance
export const taskOperations = new TaskOperations();
