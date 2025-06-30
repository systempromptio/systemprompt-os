/**
 * @file Task logging utilities for Agent Manager
 * @module services/agent-manager/task-logger
 */

import type { TaskStore } from '../task-store.js';
import type { TaskLogEntry } from '../../types/task.js';
import { LOG_PREFIXES, RESPONSE_PREVIEW_LENGTH } from './constants.js';
import { logger } from '../../utils/logger.js';

export class TaskLogger {
  constructor(private readonly taskStore: TaskStore) {}

  /**
   * Logs session creation
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
        prefix: LOG_PREFIXES.SESSION_CREATED,
        message: `${type} session created: ${sessionId}, working directory: ${projectPath}`,
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
          prefix: LOG_PREFIXES.SESSION_CONTEXT,
          message: `Initial context provided: ${initialContext.substring(0, 200)}...`,
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
   */
  async logCommandSent(taskId: string, command: string, mcpSessionId?: string): Promise<void> {
    try {
      const logEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'agent',
        prefix: LOG_PREFIXES.COMMAND_SENT,
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
        prefix: LOG_PREFIXES.RESPONSE_RECEIVED,
        message: `Duration: ${duration}ms, Output length: ${outputLength} chars`,
        metadata: {
          duration,
          outputLength,
          fullOutput: output,
        }
      };
      await this.taskStore.addLog(taskId, responseEntry, mcpSessionId);

      if (outputLength > 0) {
        // Try to parse JSON output
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
          prefix: LOG_PREFIXES.RESPONSE_PREVIEW,
          message: isJson ? 'JSON Response' : output.substring(0, RESPONSE_PREVIEW_LENGTH) + (outputLength > RESPONSE_PREVIEW_LENGTH ? '...' : ''),
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
   */
  async logError(taskId: string, prefix: string, error: any, mcpSessionId?: string): Promise<void> {
    try {
      const message = error instanceof Error ? error.message : String(error);
      const logEntry: TaskLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        type: 'system',
        prefix,
        message,
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
   */
  async logSessionTermination(
    taskId: string,
    sessionId: string,
    type: string,
    success: boolean,
    mcpSessionId?: string
  ): Promise<void> {
    try {
      if (success) {
        await this.taskStore.addLog(
          taskId,
          `${LOG_PREFIXES.SESSION_TERMINATED} ${type} session ended successfully: ${sessionId}`,
          mcpSessionId
        );
      } else {
        await this.taskStore.addLog(
          taskId,
          `${LOG_PREFIXES.SESSION_ERROR} Failed to end ${type} session: ${sessionId}`,
          mcpSessionId
        );
      }
    } catch (error) {
      logger.error('Failed to log session termination', { taskId, sessionId, error });
    }
  }
}