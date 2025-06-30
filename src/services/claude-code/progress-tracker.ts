/**
 * @file Progress tracking for Claude Code service
 * @module services/claude-code/progress-tracker
 */

import type { ClaudeCodeSession, ProgressEvent } from './types.js';
import { logger } from '../../utils/logger.js';
import type { TaskStore } from '../task-store.js';
import type { TaskLogEntry } from '../../types/task.js';
import { LogParser } from '../../utils/log-parser.js';

export class ProgressTracker {
  constructor(private readonly taskStore: TaskStore) {}

  /**
   * Parses and logs progress from stream data
   */
  async parseProgressFromStream(session: ClaudeCodeSession, data: string): Promise<ProgressEvent | void> {
    if (!session.taskId || !data.trim()) return;

    try {
      // Parse the stream data for structured information
      const parsedEntries = LogParser.parseAgentOutput(data.trim(), 'claude');
      
      if (parsedEntries.length > 0) {
        // Log structured entries
        for (const entry of parsedEntries) {
          await this.taskStore.addLog(session.taskId, entry, session.mcpSessionId);
        }
      } else {
        // Log raw data as output type
        const logEntry: TaskLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'output',
          message: data.trim(),
          metadata: {
            source: 'claude',
            sessionId: session.id,
          }
        };
        await this.taskStore.addLog(session.taskId, logEntry, session.mcpSessionId);
      }
      
      // Emit progress event
      return {
        taskId: session.taskId,
        event: 'stream:data',
        data: data.trim()
      } as ProgressEvent;
    } catch (error) {
      logger.error('Error parsing progress', { 
        sessionId: session.id,
        taskId: session.taskId,
        error 
      });
    }
  }

  /**
   * Logs assistant message to task
   */
  async logAssistantMessage(taskId: string, content: any[], mcpSessionId?: string): Promise<void> {
    if (!Array.isArray(content)) return;

    for (const item of content) {
      if (item.type === 'text' && item.text) {
        const logEntry: TaskLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'agent',
          prefix: 'ASSISTANT_MESSAGE',
          message: item.text,
          metadata: {
            source: 'claude',
          }
        };
        await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
      } else if (item.type === 'tool_use') {
        const logEntry: TaskLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'tool',
          prefix: 'TOOL_USE',
          message: `${item.name || 'unknown'} called`,
          metadata: {
            source: 'claude',
            toolName: item.name,
            toolInput: item.input,
            toolId: item.id,
          }
        };
        await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
      }
    }
  }

  /**
   * Creates a progress event
   */
  createProgressEvent(taskId: string, event: string, data: string): ProgressEvent {
    return {
      taskId,
      event,
      data
    };
  }
}