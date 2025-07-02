/**
 * @fileoverview Progress tracking for Claude Code tasks
 * @module services/claude-code/progress-tracker
 * 
 * @remarks
 * This module provides progress tracking capabilities for Claude Code sessions.
 * It parses streaming output, extracts structured information, and logs progress
 * to the task store. It supports both structured log parsing and raw output logging.
 * 
 * @example
 * ```typescript
 * import { ProgressTracker } from './progress-tracker';
 * import { TaskStore } from '../task-store';
 * 
 * const tracker = new ProgressTracker(TaskStore.getInstance());
 * 
 * // Parse progress from stream
 * const event = await tracker.parseProgressFromStream(
 *   session,
 *   '$ npm test\n✓ All tests passed'
 * );
 * 
 * // Log assistant message
 * await tracker.logAssistantMessage(
 *   'task-123',
 *   [{ type: 'text', text: 'Task completed' }]
 * );
 * ```
 */

import type { ClaudeCodeSession, ProgressEvent } from './types.js';
import { logger } from '../../utils/logger.js';
import type { TaskStore } from '../task-store.js';
import type { TaskLogEntry } from '../../types/task.js';
import { LogParser } from '../../utils/log-parser.js';

/**
 * Tracks and logs progress for Claude Code tasks
 * 
 * @class ProgressTracker
 * 
 * @remarks
 * This class integrates with the TaskStore to provide real-time progress
 * tracking for Claude Code sessions. It parses output streams, identifies
 * structured information, and maintains a detailed log of task execution.
 */
export class ProgressTracker {
  /**
   * Creates a new progress tracker
   * 
   * @param taskStore - The task store for logging progress
   */
  constructor(private readonly taskStore: TaskStore) {}

  /**
   * Parses progress information from streaming data and logs to task store
   * 
   * @param session - The Claude Code session
   * @param data - The stream data to parse
   * @returns Progress event if created, void otherwise
   * 
   * @remarks
   * This method:
   * 1. Attempts to parse structured log entries using LogParser
   * 2. Falls back to raw output logging if no structure found
   * 3. Emits progress events for real-time tracking
   * 4. Handles errors gracefully without interrupting the stream
   * 
   * @example
   * ```typescript
   * const event = await tracker.parseProgressFromStream(
   *   session,
   *   'Running tests...\n✓ 10 tests passed'
   * );
   * if (event) {
   *   console.log(`Progress: ${event.data}`);
   * }
   * ```
   */
  async parseProgressFromStream(session: ClaudeCodeSession, data: string): Promise<ProgressEvent | void> {
    if (!session.taskId || !data.trim()) return;

    try {
      const parsedEntries = LogParser.parseAgentOutput(data.trim(), 'claude');
      
      if (parsedEntries.length > 0) {
        for (const entry of parsedEntries) {
          await this.taskStore.addLog(session.taskId, entry, session.mcpSessionId);
        }
      } else {
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
   * Logs assistant messages and tool usage to the task store
   * 
   * @param taskId - The task ID to log to
   * @param content - Array of content items from assistant response
   * @param mcpSessionId - Optional MCP session ID for correlation
   * 
   * @remarks
   * Processes different types of assistant content:
   * - Text messages: Logged as agent type with ASSISTANT_MESSAGE prefix
   * - Tool usage: Logged as tool type with detailed metadata
   * - Other content types: Ignored
   * 
   * @example
   * ```typescript
   * await tracker.logAssistantMessage('task-123', [
   *   { type: 'text', text: 'I will now run the tests' },
   *   { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }
   * ]);
   * ```
   */
  async logAssistantMessage(taskId: string, content: unknown[], mcpSessionId?: string): Promise<void> {
    if (!Array.isArray(content)) return;

    for (const item of content) {
      if (typeof item === 'object' && item !== null && 'type' in item) {
        const contentItem = item as { type: string; text?: string; name?: string; input?: unknown; id?: string };
        if (contentItem.type === 'text' && contentItem.text) {
          const logEntry: TaskLogEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            type: 'agent',
            prefix: 'ASSISTANT_MESSAGE',
            message: contentItem.text,
            metadata: {
              source: 'claude',
            }
          };
          await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
        } else if (contentItem.type === 'tool_use') {
          const logEntry: TaskLogEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            type: 'tool',
            prefix: 'TOOL_USE',
            message: `${contentItem.name || 'unknown'} called`,
            metadata: {
              source: 'claude',
              toolName: contentItem.name,
              toolInput: contentItem.input,
              toolId: contentItem.id,
            }
          };
          await this.taskStore.addLog(taskId, logEntry, mcpSessionId);
        }
      }
    }
  }

  /**
   * Creates a structured progress event
   * 
   * @param taskId - The task ID
   * @param event - The event type
   * @param data - The event data
   * @returns A progress event object
   * 
   * @example
   * ```typescript
   * const event = tracker.createProgressEvent(
   *   'task-123',
   *   'test:complete',
   *   'All tests passed'
   * );
   * ```
   */
  createProgressEvent(taskId: string, event: string, data: string): ProgressEvent {
    return {
      taskId,
      event,
      data
    };
  }
}