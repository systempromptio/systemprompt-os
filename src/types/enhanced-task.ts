/**
 * @fileoverview Enhanced Task type definitions with tool tracking
 * @module types/enhanced-task
 *
 * @remarks
 * This module provides enhanced task types with comprehensive tool usage
 * tracking, strongly typed logs, and Claude metrics.
 */

import type { Task, TaskLogEntry, TaskStatus, AITool } from './task.js';

// ==================== Tool Usage Types ====================

/**
 * Tool invocation details
 * @interface
 */
export interface ToolInvocation {
  /**
   * Unique identifier for this tool invocation
   */
  id: string;
  
  /**
   * Name of the tool
   */
  toolName: string;
  
  /**
   * ISO timestamp when tool was invoked
   */
  startTime: string;
  
  /**
   * ISO timestamp when tool completed
   */
  endTime?: string;
  
  /**
   * Duration in milliseconds
   */
  duration?: number;
  
  /**
   * Tool input parameters (strongly typed, no stringified JSON)
   */
  parameters: Record<string, any>;
  
  /**
   * Tool result (strongly typed, no stringified JSON)
   */
  result?: any;
  
  /**
   * Whether the tool invocation was successful
   */
  success?: boolean;
  
  /**
   * Error message if tool failed
   */
  error?: string;
}

/**
 * Summary of tool usage in a task
 * @interface
 */
export interface ToolUsageSummary {
  /**
   * Total number of tool invocations
   */
  totalInvocations: number;
  
  /**
   * Number of successful invocations
   */
  successfulInvocations: number;
  
  /**
   * Number of failed invocations
   */
  failedInvocations: number;
  
  /**
   * Tool invocation counts by tool name
   */
  byTool: Record<string, number>;
  
  /**
   * Most used tools (top 5)
   */
  mostUsedTools: Array<{
    toolName: string;
    count: number;
  }>;
  
  /**
   * Total duration spent in tool execution (ms)
   */
  totalDuration: number;
}

// ==================== Claude Metrics ====================

/**
 * Claude execution metrics
 * @interface
 */
export interface ClaudeMetrics {
  /**
   * Claude session ID
   */
  sessionId: string;
  
  /**
   * Process ID of Claude execution
   */
  pid?: number;
  
  /**
   * Execution duration in milliseconds
   */
  duration: number;
  
  /**
   * API duration in milliseconds
   */
  apiDuration?: number;
  
  /**
   * Number of turns/iterations
   */
  turns: number;
  
  /**
   * Exit code (0 for success)
   */
  exitCode?: number;
  
  /**
   * Token usage
   */
  usage: {
    /**
     * Input tokens consumed
     */
    inputTokens: number;
    
    /**
     * Output tokens generated
     */
    outputTokens: number;
    
    /**
     * Cache creation tokens
     */
    cacheCreationTokens: number;
    
    /**
     * Cache read tokens
     */
    cacheReadTokens: number;
    
    /**
     * Total tokens
     */
    totalTokens: number;
  };
  
  /**
   * Cost in USD
   */
  cost: number;
  
  /**
   * Service tier used
   */
  serviceTier?: string;
  
  /**
   * Whether execution was successful
   */
  success: boolean;
  
  /**
   * The final result message from Claude
   */
  resultMessage?: string;
}

// ==================== Enhanced Log Entry ====================

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

// ==================== Enhanced Task ====================

/**
 * Enhanced task with comprehensive tracking
 * @interface
 * @extends {Task}
 */
export interface EnhancedTask extends Omit<Task, 'logs' | 'result'> {
  /**
   * Enhanced log entries with structured data
   */
  readonly logs: EnhancedLogEntry[];
  
  /**
   * Structured task result (never stringified JSON)
   */
  readonly result?: {
    /**
     * The final output/result text
     */
    output: string;
    
    /**
     * Whether the task was successful
     */
    success: boolean;
    
    /**
     * Error message if failed
     */
    error?: string;
    
    /**
     * Additional result data
     */
    data?: any;
  };
  
  /**
   * All tool invocations during task execution
   */
  readonly toolInvocations: ToolInvocation[];
  
  /**
   * Tool usage summary
   */
  readonly toolUsageSummary: ToolUsageSummary;
  
  /**
   * Claude execution metrics
   */
  readonly claudeMetrics?: ClaudeMetrics;
  
  /**
   * Files created or modified during task
   */
  readonly filesAffected: Array<{
    path: string;
    operation: 'created' | 'modified' | 'deleted' | 'read';
    timestamp: string;
  }>;
  
  /**
   * Commands executed during task
   */
  readonly commandsExecuted: Array<{
    command: string;
    exitCode: number;
    duration: number;
    timestamp: string;
  }>;
}

// ==================== Helper Functions ====================

/**
 * Extracts tool invocations from logs
 * @param logs - Task log entries
 * @returns Array of tool invocations
 */
export function extractToolInvocations(logs: EnhancedLogEntry[]): ToolInvocation[] {
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
export function extractClaudeMetrics(logs: EnhancedLogEntry[]): ClaudeMetrics | undefined {
  const processStart = logs.find(log => log.prefix === 'PROCESS_START');
  const processEnd = logs.find(log => log.prefix === 'PROCESS_END');
  const resultLog = logs.find(log => log.prefix === 'CLAUDE_RESULT' || log.prefix === 'RESULT');
  
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
    serviceTier: result.usage?.serviceTier,
    success: !result.isError,
    resultMessage: result.result,
  };
}

/**
 * Converts a regular task to an enhanced task
 * @param task - Regular task
 * @returns Enhanced task with extracted metrics
 */
export function enhanceTask(task: Task): EnhancedTask {
  const enhancedLogs = task.logs as EnhancedLogEntry[];
  const toolInvocations = extractToolInvocations(enhancedLogs);
  const toolUsageSummary = generateToolUsageSummary(toolInvocations);
  const claudeMetrics = extractClaudeMetrics(enhancedLogs);
  
  // Extract files affected from logs
  const filesAffected: EnhancedTask['filesAffected'] = [];
  for (const log of enhancedLogs) {
    if (log.metadata?.fileName) {
      filesAffected.push({
        path: log.metadata.fileName,
        operation: log.metadata.operation || 'modified',
        timestamp: log.timestamp,
      });
    }
  }
  
  // Extract commands executed from logs
  const commandsExecuted: EnhancedTask['commandsExecuted'] = [];
  for (const log of enhancedLogs) {
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
  let structuredResult: EnhancedTask['result'];
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
    structuredResult = task.result as EnhancedTask['result'];
  }
  
  return {
    ...task,
    logs: enhancedLogs,
    result: structuredResult,
    toolInvocations,
    toolUsageSummary,
    claudeMetrics,
    filesAffected,
    commandsExecuted,
  };
}