/**
 * @fileoverview Task helper utilities
 * @module utils/task-helpers
 *
 * @remarks
 * Helper functions for extracting metrics and summaries from task logs
 */

import type { Task, TaskLogEntry, ToolInvocation, ToolUsageSummary, ClaudeMetrics } from '../types/task.js';

/**
 * Enhanced log entry with structured data
 * @interface
 * @extends {TaskLogEntry}
 */
export interface EnhancedLogEntry extends TaskLogEntry {
  /**
   * Structured data (never stringified JSON)
   */
  data?: {
    /**
     * For tool logs: the tool invocation details
     */
    toolInvocation?: ToolInvocation;
    
    /**
     * For result logs: parsed Claude result
     */
    claudeResult?: {
      type: string;
      subtype: string;
      isError: boolean;
      result: string;
      sessionId: string;
      duration: number;
      cost: number;
      usage: ClaudeMetrics['usage'];
    };
    
    /**
     * For process logs: process details
     */
    process?: {
      pid: number;
      command: string;
      exitCode?: number;
      duration?: number;
    };
    
    /**
     * Any other structured data
     */
    [key: string]: any;
  };
}

/**
 * Extracts tool invocations from logs
 * @param logs - Task log entries
 * @returns Array of tool invocations
 */
export function extractToolInvocations(logs: TaskLogEntry[]): ToolInvocation[] {
  const invocations: ToolInvocation[] = [];
  const pendingInvocations = new Map<string, ToolInvocation>();
  
  for (const log of logs) {
    if (log.type === 'tool' && log.prefix === 'TOOL_START') {
      const toolId = log.metadata?.toolId || `tool_${Date.now()}`;
      const invocation: ToolInvocation = {
        id: toolId,
        toolName: log.metadata?.toolName || 'Unknown',
        startTime: log.timestamp,
        parameters: log.metadata?.parameters || {},
      };
      pendingInvocations.set(toolId, invocation);
    } else if (log.type === 'tool' && log.prefix === 'TOOL_END') {
      const toolId = log.metadata?.toolId;
      if (toolId && pendingInvocations.has(toolId)) {
        const invocation = pendingInvocations.get(toolId)!;
        invocation.endTime = log.timestamp;
        invocation.duration = log.metadata?.duration;
        invocation.success = log.metadata?.success;
        invocation.result = log.metadata?.result;
        invocation.error = log.metadata?.error;
        invocations.push(invocation);
        pendingInvocations.delete(toolId);
      }
    }
  }
  
  // Add any pending invocations (tools that started but didn't complete)
  for (const invocation of pendingInvocations.values()) {
    invocations.push(invocation);
  }
  
  return invocations;
}

/**
 * Generates tool usage summary from invocations
 * @param invocations - Array of tool invocations
 * @returns Tool usage summary
 */
export function generateToolUsageSummary(invocations: ToolInvocation[]): ToolUsageSummary {
  const byTool: Record<string, number> = {};
  let successfulInvocations = 0;
  let failedInvocations = 0;
  let totalDuration = 0;
  
  for (const invocation of invocations) {
    byTool[invocation.toolName] = (byTool[invocation.toolName] || 0) + 1;
    
    if (invocation.success === true) {
      successfulInvocations++;
    } else if (invocation.success === false) {
      failedInvocations++;
    }
    
    if (invocation.duration) {
      totalDuration += invocation.duration;
    }
  }
  
  const mostUsedTools = Object.entries(byTool)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([toolName, count]) => ({ toolName, count }));
  
  return {
    totalInvocations: invocations.length,
    successfulInvocations,
    failedInvocations,
    byTool,
    mostUsedTools,
    totalDuration,
  };
}

/**
 * Extracts Claude metrics from logs
 * @param logs - Task log entries
 * @returns Claude metrics if found
 */
export function extractClaudeMetrics(logs: TaskLogEntry[]): ClaudeMetrics | undefined {
  const enhancedLogs = logs as EnhancedLogEntry[];
  const processStart = enhancedLogs.find(log => log.prefix === 'PROCESS_START');
  const processEnd = enhancedLogs.find(log => log.prefix === 'PROCESS_END');
  const resultLog = enhancedLogs.find(log => log.prefix === 'CLAUDE_RESULT' || log.prefix === 'RESULT');
  
  if (!resultLog || !resultLog.data?.claudeResult) {
    return undefined;
  }
  
  const result = resultLog.data.claudeResult;
  
  return {
    sessionId: result.sessionId,
    pid: processStart?.data?.process?.pid,
    duration: result.duration,
    apiDuration: result.usage ? result.duration : undefined,
    turns: 1, // Will be updated when we have turn tracking
    exitCode: processEnd?.data?.process?.exitCode,
    usage: result.usage,
    cost: result.cost,
    serviceTier: undefined,
    success: !result.isError,
    resultMessage: result.result,
  };
}

/**
 * Enhances a task with extracted metrics and summaries
 * @param task - Regular task
 * @returns Task with extracted metrics
 */
export function enhanceTask(task: Task): Task {
  const toolInvocations = extractToolInvocations(task.logs);
  const toolUsageSummary = generateToolUsageSummary(toolInvocations);
  const claudeMetrics = extractClaudeMetrics(task.logs);
  
  // Extract files affected from logs
  const filesAffected: Task['filesAffected'] = [];
  for (const log of task.logs) {
    if (log.metadata?.fileName) {
      filesAffected.push({
        path: log.metadata.fileName,
        operation: log.metadata.operation || 'modified',
        timestamp: log.timestamp,
      });
    }
  }
  
  // Extract commands executed from logs
  const commandsExecuted: Task['commandsExecuted'] = [];
  for (const log of task.logs) {
    if (log.type === 'tool' && log.metadata?.toolName === 'Bash') {
      commandsExecuted.push({
        command: log.metadata.command || log.message,
        exitCode: log.metadata.exitCode || 0,
        duration: log.metadata.duration || 0,
        timestamp: log.timestamp,
      });
    }
  }
  
  // Parse result if it's stringified JSON
  let structuredResult: Task['result'];
  if (task.result && typeof task.result === 'string') {
    try {
      const parsed = JSON.parse(task.result);
      if (parsed.type === 'result') {
        structuredResult = {
          output: parsed.result,
          success: !parsed.is_error,
          error: parsed.is_error ? parsed.result : undefined,
          data: parsed,
        };
      }
    } catch {
      // Not JSON, use as-is
      structuredResult = {
        output: task.result as string,
        success: task.status === 'completed' || task.status === 'waiting',
      };
    }
  } else if (task.result) {
    structuredResult = task.result as Task['result'];
  }
  
  return {
    ...task,
    result: structuredResult,
    toolInvocations,
    toolUsageSummary,
    claudeMetrics,
    filesAffected,
    commandsExecuted,
  };
}