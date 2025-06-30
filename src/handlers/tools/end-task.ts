/**
 * @file End task orchestrator tool
 * @module handlers/tools/orchestrator/end-task
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import { logger } from '../../utils/logger.js';
import {
  EndTaskArgsSchema,
  type EndTaskArgs,
  TaskNotFoundError
} from './utils/index.js';
import {
  validateInput,
  taskOperations,
  agentOperations
} from './utils/index.js';
import { TASK_STATUS } from '../../constants/task-status.js';

/**
 * Result of ending a task
 */
interface EndTaskResult {
  id: string;
  description: string;
  status: string;
  duration: string;
  session_closed: boolean;
  summary: {
    logs_count: number;
    final_state: string;
    ended_at: string;
  };
}

/**
 * Ends a task by updating its status and closing the associated process
 * 
 * @param args - Task termination parameters (only id required)
 * @param context - Execution context containing session information
 * @returns Task execution summary and status
 * 
 * @example
 * ```typescript
 * await handleEndTask({
 *   id: "task_abc123"
 * }, { sessionId: "session_123" });
 * ```
 */
export const handleEndTask: ToolHandler<EndTaskArgs> = async (
  args: unknown,
  context?: ToolHandlerContext
): Promise<CallToolResult> => {
  try {
    // Validate input
    const validated = validateInput(EndTaskArgsSchema, args);
    
    logger.info('Ending task', {
      taskId: validated.id,
      sessionId: context?.sessionId
    });
    
    // Get the task
    const task = await taskOperations.taskStore.getTask(validated.id);
    if (!task) {
      throw new TaskNotFoundError(validated.id);
    }
    
    // Calculate duration
    const startTime = task.started_at ? new Date(task.started_at).getTime() : new Date(task.created_at).getTime();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Update task status to completed
    const completedAt = new Date().toISOString();
    const finalStatus = TASK_STATUS.COMPLETED;  // Fully completed when ending task
    await taskOperations.updateTaskStatus(
      task.id,
      finalStatus,
      context?.sessionId,
      {
        completedAt
      }
    );
    
    // Close the associated process if exists
    let sessionClosed = false;
    if (task.assigned_to) {
      try {
        await agentOperations.endAgentSession(task.assigned_to, `Task completed`);
        sessionClosed = true;
        await taskOperations.addTaskLog(
          task.id,
          `Task ended`,
          context?.sessionId
        );
      } catch (error) {
        logger.warn('Failed to close agent session', { 
          sessionId: task.assigned_to,
          error 
        });
        await taskOperations.addTaskLog(
          task.id,
          `Warning: Could not fully terminate agent session`,
          context?.sessionId
        );
      }
    }
    
    // Format duration in human-readable format
    const formatDuration = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    };
    
    // Create result
    const result: EndTaskResult = {
      id: task.id,
      description: task.description,
      status: finalStatus,
      duration: formatDuration(duration),
      session_closed: sessionClosed,
      summary: {
        logs_count: task.logs?.length || 0,
        final_state: finalStatus,
        ended_at: completedAt
      }
    };
    
    logger.info('Task ended successfully', {
      taskId: task.id,
      status: finalStatus,
      duration,
      sessionClosed
    });
    
    return formatToolResponse({
      message: `Task ended successfully`,
      result
    });
    
  } catch (error) {
    logger.error('Failed to end task', { error, args });
    
    if (error instanceof TaskNotFoundError) {
      return formatToolResponse({
        status: 'error',
        message: error.message,
        error: {
          type: 'task_not_found',
          details: { taskId: error.message.split(': ')[1] }
        }
      });
    }
    
    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to end task',
      error: {
        type: 'task_end_error',
        details: error instanceof Error ? error.stack : undefined
      }
    });
  }
};