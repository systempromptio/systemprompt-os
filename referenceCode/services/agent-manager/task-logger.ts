/**
 * @fileoverview Task logging utilities for Agent Manager
 * @module services/agent-manager/task-logger
 * 
 * @remarks
 * This module provides structured logging for task-related events in the agent
 * manager. It creates detailed log entries that are stored in the task store,
 * enabling comprehensive tracking of agent activities and debugging.
 * 
 * @example
 * ```typescript
 * import { TaskLogger } from './task-logger';
 * 
 * const taskLogger = new TaskLogger(taskStore);
 * 
 * await taskLogger.logSessionCreated(
 *   'task-123',
 *   'session-456',
 *   'claude',
 *   '/path/to/project'
 * );
 * 
 * await taskLogger.logCommandSent('task-123', 'Build a login form');
 * ```
 */

import type { TaskStore } from '../task-store.js';
import type { TaskLogEntry } from '../../types/task.js';
import { RESPONSE_PREVIEW_LENGTH } from './constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Handles logging of task-related events and messages
 * 
 * @class TaskLogger
 * 
 * @remarks
 * This class provides methods for logging:
 * - Session lifecycle events (creation, termination)
 * - Command and response pairs
 * - Errors and exceptions
 * - Structured metadata for analysis
 */
export class TaskLogger {
  /**
   * Creates a new task logger
   * 
   * @param taskStore - The task store for persisting logs
   */
  constructor(private readonly taskStore: TaskStore) {}

  /**
   * Logs session creation
   * 
   * @param taskId - The task ID
   * @param sessionId - The session ID
   * @param type - The agent type
   * @param projectPath - The project directory path
   * @param initialContext - Optional initial context/instructions
   * @param mcpSessionId - Optional MCP session ID
   * 
   * @remarks
   * Creates two log entries:
   * 1. Agent started event with session metadata
   * 2. Context loaded event if initial context is provided
   */
  async logSessionCreated(
    taskId: string,
    sessionId: string,
    type: string,
    projectPath: string,
    initialContext?: string,
    mcpSessionId?: string
  ): Promise<void> {
    try {
      const logEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'system',
        message: `Agent started`,
        metadata: {
          sessionId,
          agentType: type,
          projectPath,
        }
      };
      await this.taskStore.addLog(taskId, logEntry, mcpSessionId);

      if (initialContext) {
        const contextEntry: TaskLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'system',
          message: `Context loaded`,
          metadata: {
            fullContext: initialContext,
          }
        };
        await this.taskStore.addLog(taskId, contextEntry, mcpSessionId);
      }
    } catch (error) {
      logger.error('Failed to log session creation', { taskId, sessionId, error });
    }
  }

  /**
   * Logs command being sent
   * 
   * @param taskId - The task ID
   * @param command - The command text
   * @param mcpSessionId - Optional MCP session ID
   */
  async logCommandSent(taskId: string, command: string, mcpSessionId?: string): Promise<void> {
    try {
      const logEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'agent',
        message: command,
        metadata: {
          commandLength: command.length,
        }
      };
      await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
    } catch (error) {
      logger.error('Failed to log command', { taskId, error });
    }
  }

  /**
   * Logs response received
   * 
   * @param taskId - The task ID
   * @param duration - Response time in milliseconds
   * @param outputLength - Length of the output
   * @param output - The full output text
   * @param mcpSessionId - Optional MCP session ID
   * 
   * @remarks
   * Creates two log entries:
   * 1. Response metadata with timing information
   * 2. Output preview or parsed JSON if applicable
   */
  async logResponseReceived(
    taskId: string,
    duration: number,
    outputLength: number,
    output: string,
    mcpSessionId?: string
  ): Promise<void> {
    try {
      const responseEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'agent',
        message: `Response received (${Math.round(duration/1000)}s)`,
        metadata: {
          duration,
          outputLength,
          fullOutput: output,
        }
      };
      await this.taskStore.addLog(taskId, responseEntry, mcpSessionId);

      if (outputLength > 0) {
        let parsedOutput: any = null;
        let isJson = false;
        try {
          if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
            parsedOutput = JSON.parse(output);
            isJson = true;
          }
        } catch (e) {
          // Not JSON, treat as string
        }

        const previewEntry: TaskLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'output',
          message: isJson ? 'Result received' : output.substring(0, RESPONSE_PREVIEW_LENGTH) + (outputLength > RESPONSE_PREVIEW_LENGTH ? '...' : ''),
          metadata: {
            isPreview: true,
            fullLength: outputLength,
            isJson,
            ...(isJson && parsedOutput ? { data: parsedOutput } : { fullOutput: output })
          }
        };
        await this.taskStore.addLog(taskId, previewEntry, mcpSessionId);
      }
    } catch (error) {
      logger.error('Failed to log response', { taskId, error });
    }
  }


  /**
   * Logs error
   * 
   * @param taskId - The task ID
   * @param prefix - Error message prefix
   * @param error - The error object or message
   * @param mcpSessionId - Optional MCP session ID
   * 
   * @remarks
   * Extracts error details including name, message, and stack trace
   * if the error is an Error instance.
   */
  async logError(taskId: string, prefix: string, error: any, mcpSessionId?: string): Promise<void> {
    try {
      const message = error instanceof Error ? error.message : String(error);
      const logEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        type: 'system',
        message: `${prefix} ${message}`,
        metadata: {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } : error,
        }
      };
      await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
    } catch (logError) {
      logger.error('Failed to log error', { taskId, error: logError });
    }
  }

  /**
   * Logs session termination
   * 
   * @param taskId - The task ID
   * @param sessionId - The session ID
   * @param success - Whether termination was successful
   * @param mcpSessionId - Optional MCP session ID
   */
  async logSessionTermination(
    taskId: string,
    sessionId: string,
    success: boolean,
    mcpSessionId?: string
  ): Promise<void> {
    try {
      if (success) {
        await this.taskStore.addLog(
          taskId,
          `Session ended`,
          mcpSessionId
        );
      } else {
        await this.taskStore.addLog(
          taskId,
          `Error: Failed to end session`,
          mcpSessionId
        );
      }
    } catch (error) {
      logger.error('Failed to log session termination', { taskId, sessionId, error });
    }
  }
}