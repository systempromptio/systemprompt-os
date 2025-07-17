/**
 * @fileoverview Report task orchestrator tool handler that generates comprehensive
 * reports on individual tasks or all tasks with statistics and activity summaries
 * @module handlers/tools/orchestrator/report-task
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import { logger } from '../../utils/logger.js';
import {
  ReportTaskArgsSchema,
  type ReportTaskArgs
} from './utils/index.js';
import {
  validateInput,
  taskOperations
} from './utils/index.js';
import type { Task } from '../../types/task.js';
import { TASK_STATUS } from '../../constants/task-status.js';

/**
 * Generates reports on task(s) - either a single task by ID or all tasks
 * 
 * @param args - Optional task ID
 * @param context - Execution context containing session information
 * @returns Array of tasks or single task details
 * 
 * @example
 * ```typescript
 * // Get all tasks
 * await handleReportTask({});
 * 
 * // Get specific task
 * await handleReportTask({ id: "task_123" });
 * ```
 */
export const handleReportTask: ToolHandler<ReportTaskArgs> = async (
  args: unknown,
  context?: ToolHandlerContext
): Promise<CallToolResult> => {
  try {
    const validated = validateInput(ReportTaskArgsSchema, args);
    
    logger.info('Generating task report', {
      taskId: validated.id,
      sessionId: context?.sessionId
    });
    
    if (validated.id) {
      const task = await taskOperations.taskStore.getTask(validated.id);
      
      if (!task) {
        return formatToolResponse({
          status: 'error',
          message: `Task not found: ${validated.id}`
        });
      }
      
      const taskReport = formatTaskReport(task);
      
      return formatToolResponse({
        message: `Task report for: ${task.description}`,
        result: taskReport
      });
      
    } else {
      const tasks = await taskOperations.taskStore.getTasks();
      
      if (tasks.length === 0) {
        return formatToolResponse({
          message: 'No tasks found',
          result: []
        });
      }
      
      const taskReports = tasks.map(task => formatTaskReport(task));
      
      const statistics = calculateStatistics(tasks);
      
      return formatToolResponse({
        message: `Found ${tasks.length} task(s)`,
        result: {
          tasks: taskReports,
          statistics
        }
      });
    }
    
  } catch (error) {
    logger.error('Failed to generate task report', { error, args });
    
    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to generate report',
      error: {
        type: 'report_generation_error',
        details: error instanceof Error ? error.stack : undefined
      }
    });
  }
};

/**
 * Formats a task for the report
 * 
 * @param task - Task to format
 * @returns Formatted task report with duration and statistics
 */
function formatTaskReport(task: Task) {
  const duration = calculateDuration(task);
  
  return {
    id: task.id,
    description: task.description,
    status: task.status,
    tool: task.tool,
    created_at: task.created_at,
    updated_at: task.updated_at,
    started_at: task.started_at,
    completed_at: task.completed_at,
    assigned_to: task.assigned_to,
    error: task.error,
    result: task.result,
    logs_count: task.logs.length,
    recent_logs: task.logs.slice(-5),
    duration_seconds: duration?.seconds,
    duration_human: duration?.human
  };
}

/**
 * Calculates task duration
 * 
 * @param task - Task to calculate duration for
 * @returns Duration in seconds and human-readable format, or null if not started
 */
function calculateDuration(task: Task): { seconds: number; human: string } | null {
  if (!task.started_at) return null;
  
  const startTime = new Date(task.started_at).getTime();
  const endTime = task.completed_at 
    ? new Date(task.completed_at).getTime() 
    : Date.now();
    
  const seconds = Math.floor((endTime - startTime) / 1000);
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let human = '';
  if (hours > 0) human += `${hours}h `;
  if (minutes > 0) human += `${minutes}m `;
  human += `${secs}s`;
  
  return { seconds, human: human.trim() };
}

/**
 * Calculates statistics across all tasks
 * 
 * @param tasks - Array of tasks to analyze
 * @returns Statistical summary including counts, durations, and success rates
 */
function calculateStatistics(tasks: Task[]) {
  const byStatus: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let totalDuration = 0;
  let completedCount = 0;
  
  tasks.forEach(task => {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    
    byTool[task.tool] = (byTool[task.tool] || 0) + 1;
    
    if (task.status === TASK_STATUS.COMPLETED && task.started_at && task.completed_at) {
      const duration = calculateDuration(task);
      if (duration) {
        totalDuration += duration.seconds;
        completedCount++;
      }
    }
  });
  
  return {
    total_tasks: tasks.length,
    by_status: byStatus,
    by_tool: byTool,
    average_duration_seconds: completedCount > 0 ? Math.floor(totalDuration / completedCount) : 0,
    total_logs: tasks.reduce((sum, task) => sum + task.logs.length, 0),
    success_rate: tasks.length > 0 
      ? ((byStatus[TASK_STATUS.COMPLETED] || 0) / tasks.length * 100).toFixed(2) + '%'
      : '0%'
  };
}

