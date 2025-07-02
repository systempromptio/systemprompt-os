/**
 * @fileoverview Update task tool handler for sending new instructions to AI agents
 * @module handlers/tools/orchestrator/update-task
 * 
 * @remarks
 * This handler allows sending new instructions to active AI agent sessions.
 * It supports both task IDs and session IDs as input, automatically resolving
 * the appropriate session for task updates.
 * 
 * @example
 * ```typescript
 * import { handleUpdateTask } from './handlers/tools/update-task';
 * 
 * // Update using task ID
 * const result = await handleUpdateTask({
 *   id: "task_123",
 *   instructions: "Add error handling"
 * }, { sessionId: "mcp_456" });
 * ```
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import { logger } from '../../utils/logger.js';
import {
  UpdateTaskArgsSchema,
  type UpdateTaskArgs
} from './utils/index.js';
import { canAcceptCommands, type AgentState } from '../../types/session-states.js';
import { TASK_STATUS } from '../../constants/task-status.js';
import {
  validateInput,
  taskOperations,
  agentOperations
} from './utils/index.js';

/**
 * Sends new instructions to an active AI agent session
 * 
 * @param args - Task ID or Session ID and instructions to send
 * @param context - Execution context containing session information
 * @returns Result of the command execution
 * 
 * @remarks
 * This handler:
 * 1. Accepts either task ID or session ID
 * 2. Validates the session is in a state that can accept commands
 * 3. Executes the new instructions
 * 4. Logs progress and results to the task
 * 5. Returns execution results
 * 
 * @example
 * ```typescript
 * // Using session ID directly
 * await handleUpdateTask({
 *   id: "claude_abc123",
 *   instructions: "Add error handling to the authentication module"
 * }, { sessionId: "mcp_123" });
 * 
 * // Using task ID (will find associated session)
 * await handleUpdateTask({
 *   id: "task_xyz789",
 *   instructions: "Add unit tests for the new feature"
 * }, { sessionId: "mcp_123" });
 * ```
 */
export const handleUpdateTask: ToolHandler<UpdateTaskArgs> = async (
  args: unknown,
  context?: ToolHandlerContext
): Promise<CallToolResult> => {
  const startTime = Date.now();
  
  try {
    const validated = validateInput(UpdateTaskArgsSchema, args);
    
    logger.info('Updating task with new instructions', {
      id: validated.id,
      instructionsLength: validated.instructions.length,
      contextSessionId: context?.sessionId
    });
    
    let sessionId = validated.id;
    let taskId: string | undefined;
    
    const task = await taskOperations.taskStore.getTask(validated.id);
    if (task) {
      if (task.assigned_to) {
        sessionId = task.assigned_to;
        taskId = task.id;
        logger.info('Found task, using assigned session', {
          taskId: task.id,
          sessionId: task.assigned_to
        });
      } else {
        logger.warn('Task has no assigned session', { taskId: task.id });
        return formatToolResponse({
          status: 'error',
          message: `Task ${validated.id} has no active session`,
          error: { 
            type: 'no_active_session',
            details: {
              taskId: validated.id,
              suggestion: 'The task may have been completed or the session terminated'
            }
          }
        });
      }
    }
    
    const session = agentOperations.agentManager.getSession(sessionId);
    if (!session) {
      logger.warn('Session not found', { sessionId, originalId: validated.id });
      
      return formatToolResponse({
        status: 'error',
        message: `Session ${sessionId} not found${task ? ' for task ' + validated.id : ''}`,
        error: { 
          type: 'session_not_found',
          details: {
            id: validated.id,
            sessionId: sessionId,
            isTaskId: !!task,
            suggestion: 'Use check_status to list active sessions'
          }
        }
      });
    }
    
    const sessionValidation = validateSessionState(session);
    if (!sessionValidation.valid) {
      return formatToolResponse({
        status: 'error',
        message: sessionValidation.message,
        error: {
          type: 'invalid_session_state',
          details: {
            id: validated.id,
            currentStatus: session.status,
            expectedStatus: 'active or busy'
          }
        }
      });
    }
    
    if (task && task.status === TASK_STATUS.COMPLETED) {
      return formatToolResponse({
        status: 'error',
        message: 'Cannot update a fully completed task. The session has been terminated.',
        error: {
          type: 'task_completed',
          details: {
            taskId: task.id,
            status: task.status,
            suggestion: 'Create a new task to continue'
          }
        }
      });
    }
    
    if (!taskId && session.taskId) {
      taskId = session.taskId;
    }
    
    if (taskId) {
      await taskOperations.taskStore.addLog(
        taskId,
        `Updating task with new instructions...`,
        context?.sessionId
      );
    }
    
    const result = await agentOperations.executeInstructions(
      sessionId,  // Use the actual session ID, not the input ID
      validated.instructions,
      {
        taskId,
        updateProgress: true,
        timeout: 300000 // 5 minutes default timeout
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    if (taskId) {
      const logMessage = result.success
        ? `Update completed (${Math.floor(executionTime / 1000)}s)`
        : `Update failed: ${result.error}`;
        
      await taskOperations.taskStore.addLog(
        taskId,
        logMessage,
        context?.sessionId
      );
      
      if (result.output) {
        await taskOperations.taskStore.addLog(
          taskId,
          result.output,
          context?.sessionId
        );
      }
    }
    
    logger.info('Task update completed', {
      inputId: validated.id,
      sessionId: sessionId,
      taskId,
      success: result.success,
      executionTimeMs: executionTime
    });
    
    if (result.success) {
      return formatToolResponse({
        message: 'Instructions sent successfully',
        result: {
          id: validated.id,
          session_id: sessionId,
          task_id: taskId,
          instructions_sent: validated.instructions,
          execution_time_ms: executionTime,
          session_status: session.status,
          output: result.output
        }
      });
    } else {
      return formatToolResponse({
        status: 'error',
        message: `Failed to execute instructions: ${result.error}`,
        error: {
          type: 'command_failed',
          details: {
            id: validated.id,
            session_id: sessionId,
            error: result.error,
            execution_time_ms: executionTime
          }
        }
      });
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Failed to update task', { error, args });
    
    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update task',
      error: {
        type: 'task_update_error',
        details: {
          error: error instanceof Error ? error.stack : undefined,
          execution_time_ms: executionTime
        }
      }
    });
  }
};

/**
 * Validates that a session is in a valid state for receiving updates
 * 
 * @param session - The session to validate
 * @returns Validation result with status and message
 */
function validateSessionState(session: { status: AgentState; id: string }): { valid: boolean; message: string } {
  const status = session.status as AgentState;
  if (canAcceptCommands(status)) {
    return {
      valid: true,
      message: 'Session is ready'
    };
  }
  switch (status) {
    case 'terminated':
      return {
        valid: false,
        message: `Process ${session.id} has been terminated`
      };
    case 'error':
      return {
        valid: false,
        message: `Process ${session.id} is in error state and cannot receive commands`
      };
    case 'starting':
      return {
        valid: false,
        message: `Process ${session.id} is still starting up. Please wait a moment and try again.`
      };
    default:
      return {
        valid: false,
        message: `Process ${session.id} is in unknown state: ${session.status}`
      };
  }
}