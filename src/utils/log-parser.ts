/**
 * @fileoverview Log parser utility for extracting structured information from agent outputs
 * @module utils/log-parser
 * @since 1.0.0
 * 
 * @remarks
 * This module provides utilities for parsing output from AI agents (Claude and Gemini)
 * to extract structured information such as tool usage, file operations, and messages.
 * It helps in creating meaningful log entries from raw agent output.
 * 
 * @example
 * ```typescript
 * import { LogParser } from './utils/log-parser';
 * 
 * const claudeOutput = `
 * I'll analyze the file structure...
 * <function_calls>
 * <invoke name="read_file">
 *   <parameter name="file_path">src/index.ts</parameter>
 * </invoke>
 * </function_calls>
 * `;
 * 
 * const logEntries = LogParser.parseAgentOutput(claudeOutput, 'claude');
 * // Returns structured TaskLogEntry[] with tool usage information
 * ```
 */

import type { TaskLogEntry } from "../types/task.js";

/**
 * Represents a tool usage event extracted from agent output
 * 
 * @interface ToolUsage
 * @since 1.0.0
 */
interface ToolUsage {
  /**
   * Name of the tool being used
   */
  toolName: string;
  
  /**
   * Input parameters passed to the tool
   */
  input?: any;
  
  /**
   * Output returned by the tool
   */
  output?: any;
  
  /**
   * File name if the tool operates on files
   */
  fileName?: string;
  
  /**
   * ISO timestamp when the tool usage started
   */
  startTime?: string;
  
  /**
   * ISO timestamp when the tool usage ended
   */
  endTime?: string;
  
  /**
   * Duration of the tool execution in milliseconds
   */
  duration?: number;
}

/**
 * Utility class for parsing AI agent outputs into structured log entries
 * 
 * @class LogParser
 * @since 1.0.0
 * 
 * @remarks
 * This parser currently supports:
 * - Claude function call patterns with XML-style tags
 * - Tool invocation detection and parameter extraction
 * - File path extraction from tool parameters
 * - Generic output line capture
 * 
 * Future enhancements will include Gemini-specific patterns.
 */
export class LogParser {
  /**
   * Parse agent output and extract structured information
   * 
   * @param output - Raw output string from the AI agent
   * @param source - The source agent ('claude' or 'gemini')
   * @returns Array of structured log entries
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const output = `Analyzing the codebase...
   * <function_calls>
   * <invoke name="grep_search">
   *   <parameter name="pattern">TODO</parameter>
   *   <parameter name="file_path">src/</parameter>
   * </invoke>
   * </function_calls>
   * Found 5 TODO comments.`;
   * 
   * const entries = LogParser.parseAgentOutput(output, 'claude');
   * // Returns:
   * // [
   * //   { level: 'info', type: 'output', message: 'Analyzing the codebase...' },
   * //   { level: 'info', type: 'tool', message: 'Using tool: grep_search' },
   * //   { level: 'info', type: 'output', message: 'Found 5 TODO comments.' }
   * // ]
   * ```
   */
  static parseAgentOutput(output: string, source: 'claude' | 'gemini'): TaskLogEntry[] {
    const entries: TaskLogEntry[] = [];
    const lines = output.split('\n');
    
    let currentToolUsage: ToolUsage | null = null;
    let inToolBlock = false;

    for (const line of lines) {
      if (source === 'claude') {
        if (line.includes('<function_calls>') || line.includes('I\'ll use the')) {
          inToolBlock = true;
          currentToolUsage = { toolName: '', startTime: new Date().toISOString() };
          continue;
        }

        if (inToolBlock && line.includes('<invoke name="')) {
          const match = line.match(/name="([^"]+)"/);
          if (match && currentToolUsage) {
            currentToolUsage.toolName = match[1];
          }
        }

        if (inToolBlock && (line.includes('file_path') || line.includes('path'))) {
          const match = line.match(/"([^"]+\.[^"]+)"/);
          if (match && currentToolUsage) {
            currentToolUsage.fileName = match[1];
          }
        }

        if (line.includes('</function_calls>')) {
          inToolBlock = false;
          if (currentToolUsage?.toolName) {
            entries.push({
              timestamp: currentToolUsage.startTime || new Date().toISOString(),
              level: 'info',
              type: 'tool',
              message: `Using tool: ${currentToolUsage.toolName}${currentToolUsage.fileName ? ` on ${currentToolUsage.fileName}` : ''}`,
              metadata: currentToolUsage
            });
          }
          currentToolUsage = null;
        }
      }
      
      if (source === 'gemini') {
        // TODO: Add Gemini-specific parsing patterns
      }
      
      if (!inToolBlock && line.trim()) {
        entries.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'output',
          message: line
        });
      }
    }
    
    return entries;
  }
}