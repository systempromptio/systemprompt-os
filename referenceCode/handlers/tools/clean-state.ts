/**
 * @fileoverview Clean state orchestrator tool handler that removes all tasks
 * from the system for cleanup and reset operations
 * @module handlers/tools/orchestrator/clean-state
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import { logger } from '../../utils/logger.js';
import {
  type CleanStateArgs
} from './utils/index.js';
import {
  taskOperations
} from './utils/index.js';

/**
 * Cleans up system state by removing all tasks
 * 
 * @param args - No parameters required
 * @param context - Execution context containing session information
 * @returns Summary of deleted tasks
 * 
 * @example
 * ```typescript
 * // Delete all tasks
 * await handleCleanState({});
 * ```
 */
export const handleCleanState: ToolHandler<CleanStateArgs> = async (
  args: unknown,
  context?: ToolHandlerContext
): Promise<CallToolResult> => {
  const startTime = Date.now();
  
  try {
    logger.info('Starting cleanup operation', {
      sessionId: context?.sessionId
    });
    
    const tasks = await taskOperations.taskStore.getAllTasks();
    const taskIds = tasks.map(t => t.id);
    
    logger.info(`[CleanState] Found ${tasks.length} tasks to delete`);
    logger.info(`[CleanState] Task IDs: ${taskIds.join(', ')}`);
    
    const fs = await import('fs/promises');
    const path = await import('path');
    const statePath = process.env.STATE_PATH || './coding-agent-state';
    const tasksDir = path.join(statePath, 'tasks');
    
    try {
      const filesBefore = await fs.readdir(tasksDir);
      logger.info(`[CleanState] Files in tasks directory BEFORE deletion: ${filesBefore.length}`);
      logger.info(`[CleanState] Files: ${filesBefore.join(', ')}`);
    } catch (error) {
      logger.error(`[CleanState] Could not read tasks directory: ${error}`);
    }
    
    for (const taskId of taskIds) {
      logger.info(`[CleanState] Deleting task: ${taskId}`);
      await taskOperations.taskStore.deleteTask(taskId);
      logger.info(`[CleanState] Deleted task: ${taskId}`);
    }
    
    try {
      const filesAfter = await fs.readdir(tasksDir);
      logger.info(`[CleanState] Files in tasks directory AFTER deletion: ${filesAfter.length}`);
      logger.info(`[CleanState] Files: ${filesAfter.join(', ')}`);
    } catch (error) {
      logger.error(`[CleanState] Could not read tasks directory after deletion: ${error}`);
    }
    
    const remainingTasks = await taskOperations.taskStore.getAllTasks();
    logger.info(`[CleanState] Remaining tasks in memory: ${remainingTasks.length}`);
    
    logger.info('Deleted all tasks', {
      count: tasks.length
    });
    
    return formatToolResponse({
      message: `Cleaned state: removed ${tasks.length} tasks`,
      result: {
        deleted_tasks: tasks.length,
        task_ids: taskIds
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cleanup operation failed', { error, args });
    
    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to clean state',
      error: {
        type: 'cleanup_error',
        details: {
          error: error instanceof Error ? error.stack : undefined,
          duration_ms: duration
        }
      }
    });
  }
};