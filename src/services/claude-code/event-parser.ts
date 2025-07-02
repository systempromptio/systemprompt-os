/**
 * @fileoverview Claude stdout/stderr event parser for extracting structured events
 * @module services/claude-code/event-parser
 * 
 * @remarks
 * This module provides event parsing capabilities for Claude's output stream.
 * It extracts structured events from stdout/stderr, including:
 * - Tool usage (start/end)
 * - Assistant messages
 * - Errors and stack traces
 * - JSON results
 * - Stream data
 * 
 * @example
 * ```typescript
 * import { ClaudeEventParser } from './event-parser';
 * 
 * const parser = new ClaudeEventParser('session-123', 'task-456');
 * 
 * // Parse stdout line
 * const events = parser.parseLine('$ npm install');
 * // Returns tool start event for Bash command
 * 
 * // End parsing and get buffered output
 * const { events: finalEvents, output } = parser.endParsing();
 * ```
 */

import {
  ClaudeEvent,
  createToolStart,
  createToolEnd,
  createMessage,
  createStream,
  createError,
  createResult
} from '../../types/claude-events.js';
import { logger } from '../../utils/logger.js';

/**
 * Context for tracking active tool usage
 * 
 * @interface ToolUseContext
 */
interface ToolUseContext {
  /**
   * Unique identifier for the tool invocation
   */
  toolId: string;
  
  /**
   * Name of the tool being used
   */
  toolName: string;
  
  /**
   * Timestamp when the tool started
   */
  startTime: number;
  
  /**
   * Parameters passed to the tool
   */
  parameters: Record<string, unknown>;
}

/**
 * Parser for extracting structured events from Claude's output stream
 * 
 * @class ClaudeEventParser
 * 
 * @remarks
 * This parser uses pattern matching to identify and extract structured
 * events from Claude's stdout/stderr streams. It maintains context for
 * active tool usage and buffers output for result detection.
 */
export class ClaudeEventParser {
  private toolContexts: Map<string, ToolUseContext> = new Map();
  private readonly sessionId: string;
  private readonly taskId?: string;
  private outputBuffer: string[] = [];
  
  private readonly patterns = {
    toolStart: /^(?:I'll|Let me|I will|I'm going to) (?:use|run|execute|call) (?:the )?(\w+)(?: tool| command)?/i,
    toolCall: /^(?:Running|Executing|Calling|Using)(?: the)? (\w+)(?: tool| command)?:?\s*(.*)?$/i,
    toolResult: /^(?:Result|Output|Response)(?: from \w+)?:\s*$/i,
    
    bashCommand: /^\$ (.+)$/,
    readFile: /^(?:Reading|Opening) file:\s*(.+)$/i,
    writeFile: /^(?:Writing|Creating|Saving) (?:to )?file:\s*(.+)$/i,
    editFile: /^(?:Editing|Modifying|Updating) file:\s*(.+)$/i,
    
    thinking: /^(?:I need to|I should|Let me think|I'll|First,|Next,|Now,)/i,
    explanation: /^(?:This|The|Here's|I've|We|You)/i,
    
    error: /^(?:Error|Failed|Exception|Warning):\s*(.+)$/i,
    stackTrace: /^\s+at\s+.+\(.+:\d+:\d+\)$/,
    
    jsonResult: /^\{.*"type"\s*:\s*"result".*\}$/
  };
  
  /**
   * Creates a new Claude event parser
   * 
   * @param sessionId - The session ID for event tracking
   * @param taskId - Optional task ID for event association
   */
  constructor(sessionId: string, taskId?: string) {
    this.sessionId = sessionId;
    this.taskId = taskId;
  }
  
  /**
   * Parses a line of output and extracts structured events
   * 
   * @param line - The line of output to parse
   * @param streamType - Whether this is stdout or stderr
   * @returns Array of extracted Claude events
   * 
   * @example
   * ```typescript
   * const events = parser.parseLine('$ npm test');
   * // Returns: [StreamEvent, ToolStartEvent]
   * ```
   */
  parseLine(line: string, streamType: 'stdout' | 'stderr' = 'stdout'): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    const trimmed = line.trim();
    
    if (!trimmed) return events;
    
    events.push(createStream(this.sessionId, line, streamType, this.taskId));
    this.outputBuffer.push(line);
    try {
      if (this.patterns.jsonResult.test(trimmed)) {
        const resultEvent = this.parseJsonResult(trimmed);
        if (resultEvent) events.push(resultEvent);
      }
      const toolEvents = this.parseToolUsage(trimmed);
      events.push(...toolEvents);
      const messageEvent = this.parseMessage(trimmed);
      if (messageEvent) events.push(messageEvent);
      if (streamType === 'stderr' || this.patterns.error.test(trimmed)) {
        const errorEvent = this.parseError(trimmed);
        if (errorEvent) events.push(errorEvent);
      }
    } catch (error) {
      logger.error('Error parsing Claude output line', { error, line });
    }
    
    return events;
  }
  
  /**
   * Parses JSON result from Claude output
   * 
   * @private
   * @param line - The line containing potential JSON result
   * @returns Result event if parsed successfully, null otherwise
   */
  private parseJsonResult(line: string): ClaudeEvent | null {
    try {
      const data = JSON.parse(line);
      if (data.type === 'result') {
        return createResult(
          this.sessionId,
          data.result || 'Task completed',
          !data.is_error,
          data.duration_ms || 0,
          this.taskId,
          data.total_cost_usd,
          data.usage ? {
            inputTokens: data.usage.input_tokens || 0,
            outputTokens: data.usage.output_tokens || 0,
            cacheTokens: (data.usage.cache_creation_input_tokens || 0) + (data.usage.cache_read_input_tokens || 0)
          } : undefined
        );
      }
    } catch (e) {
    }
    return null;
  }
  
  /**
   * Parses tool usage patterns from output
   * 
   * @private
   * @param line - The line to check for tool usage
   * @returns Array of tool-related events
   * 
   * @remarks
   * Detects various tool invocation patterns including:
   * - Bash commands ($ prefix)
   * - File operations (read/write/edit)
   * - Generic tool calls
   * - Tool results
   */
  private parseToolUsage(line: string): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    
    const bashMatch = line.match(this.patterns.bashCommand);
    if (bashMatch) {
      const toolId = `bash_${Date.now()}`;
      const command = bashMatch[1];
      
      events.push(createToolStart(
        this.sessionId,
        'Bash',
        toolId,
        { command },
        this.taskId
      ));
      
      this.toolContexts.set(toolId, {
        toolId,
        toolName: 'Bash',
        startTime: Date.now(),
        parameters: { command }
      });
      
      return events;
    }
    const readMatch = line.match(this.patterns.readFile);
    if (readMatch) {
      const toolId = `read_${Date.now()}`;
      events.push(createToolStart(
        this.sessionId,
        'Read',
        toolId,
        { file_path: readMatch[1] },
        this.taskId
      ));
      return events;
    }
    
    const writeMatch = line.match(this.patterns.writeFile);
    if (writeMatch) {
      const toolId = `write_${Date.now()}`;
      events.push(createToolStart(
        this.sessionId,
        'Write',
        toolId,
        { file_path: writeMatch[1] },
        this.taskId
      ));
      return events;
    }
    
    const editMatch = line.match(this.patterns.editFile);
    if (editMatch) {
      const toolId = `edit_${Date.now()}`;
      events.push(createToolStart(
        this.sessionId,
        'Edit',
        toolId,
        { file_path: editMatch[1] },
        this.taskId
      ));
      return events;
    }
    const toolCallMatch = line.match(this.patterns.toolCall);
    if (toolCallMatch) {
      const toolName = toolCallMatch[1];
      const toolId = `${toolName.toLowerCase()}_${Date.now()}`;
      const params = toolCallMatch[2] ? { input: toolCallMatch[2] } : {};
      
      events.push(createToolStart(
        this.sessionId,
        toolName,
        toolId,
        params,
        this.taskId
      ));
      
      this.toolContexts.set(toolId, {
        toolId,
        toolName,
        startTime: Date.now(),
        parameters: params
      });
      
      return events;
    }
    if (this.patterns.toolResult.test(line) && this.toolContexts.size > 0) {
      const contexts = Array.from(this.toolContexts.values());
      const mostRecent = contexts[contexts.length - 1];
      
      if (mostRecent) {
        const duration = Date.now() - mostRecent.startTime;
        events.push(createToolEnd(
          this.sessionId,
          mostRecent.toolName,
          mostRecent.toolId,
          duration,
          true,
          this.taskId
        ));
        
        this.toolContexts.delete(mostRecent.toolId);
      }
    }
    
    return events;
  }
  
  /**
   * Parses assistant messages from output
   * 
   * @private
   * @param line - The line to check for message patterns
   * @returns Message event if detected, null otherwise
   */
  private parseMessage(line: string): ClaudeEvent | null {
    if (this.patterns.thinking.test(line) || this.patterns.explanation.test(line)) {
      return createMessage(
        this.sessionId,
        'assistant',
        line,
        this.taskId
      );
    }
    
    return null;
  }
  
  /**
   * Parses error messages from output
   * 
   * @private
   * @param line - The line to check for error patterns
   * @returns Error event if detected, null otherwise
   */
  private parseError(line: string): ClaudeEvent | null {
    const errorMatch = line.match(this.patterns.error);
    if (errorMatch) {
      return createError(
        this.sessionId,
        errorMatch[1] || line,
        this.taskId
      );
    }
    
    return null;
  }
  
  /**
   * Ends parsing session and returns final events and buffered output
   * 
   * @returns Object containing final events and complete output
   * 
   * @remarks
   * This method should be called when the Claude process ends to:
   * - Close any open tool contexts (marking them as failed)
   * - Return the complete buffered output
   * - Generate final events for incomplete operations
   * 
   * @example
   * ```typescript
   * const { events, output } = parser.endParsing();
   * console.log('Total events:', events.length);
   * console.log('Full output:', output);
   * ```
   */
  endParsing(): { events: ClaudeEvent[]; output: string } {
    const events: ClaudeEvent[] = [];
    
    for (const context of this.toolContexts.values()) {
      const duration = Date.now() - context.startTime;
      events.push(createToolEnd(
        this.sessionId,
        context.toolName,
        context.toolId,
        duration,
        false,
        this.taskId,
        undefined,
        'Tool did not complete normally'
      ));
    }
    
    this.toolContexts.clear();
    return {
      events,
      output: this.outputBuffer.join('\n')
    };
  }
}