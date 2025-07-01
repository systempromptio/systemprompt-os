/**
 * Claude stdout/stderr event parser
 * Extracts structured events from Claude's output stream
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

interface ToolUseContext {
  toolId: string;
  toolName: string;
  startTime: number;
  parameters: Record<string, any>;
}

export class ClaudeEventParser {
  private toolContexts: Map<string, ToolUseContext> = new Map();
  private readonly sessionId: string;
  private readonly taskId?: string;
  private outputBuffer: string[] = [];
  
  // Patterns to detect Claude events in stdout
  private readonly patterns = {
    // Tool use patterns
    toolStart: /^(?:I'll|Let me|I will|I'm going to) (?:use|run|execute|call) (?:the )?(\w+)(?: tool| command)?/i,
    toolCall: /^(?:Running|Executing|Calling|Using)(?: the)? (\w+)(?: tool| command)?:?\s*(.*)?$/i,
    toolResult: /^(?:Result|Output|Response)(?: from \w+)?:\s*$/i,
    
    // Specific tool patterns
    bashCommand: /^\$ (.+)$/,
    readFile: /^(?:Reading|Opening) file:\s*(.+)$/i,
    writeFile: /^(?:Writing|Creating|Saving) (?:to )?file:\s*(.+)$/i,
    editFile: /^(?:Editing|Modifying|Updating) file:\s*(.+)$/i,
    
    // Message patterns
    thinking: /^(?:I need to|I should|Let me think|I'll|First,|Next,|Now,)/i,
    explanation: /^(?:This|The|Here's|I've|We|You)/i,
    
    // Error patterns
    error: /^(?:Error|Failed|Exception|Warning):\s*(.+)$/i,
    stackTrace: /^\s+at\s+.+\(.+:\d+:\d+\)$/,
    
    // Result patterns (Claude JSON output)
    jsonResult: /^\{.*"type"\s*:\s*"result".*\}$/
  };
  
  constructor(sessionId: string, taskId?: string) {
    this.sessionId = sessionId;
    this.taskId = taskId;
  }
  
  /**
   * Parse a line of output and extract events
   */
  parseLine(line: string, streamType: 'stdout' | 'stderr' = 'stdout'): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    const trimmed = line.trim();
    
    if (!trimmed) return events;
    
    // Always emit stream event
    events.push(createStream(this.sessionId, line, streamType, this.taskId));
    
    // Buffer output for result detection
    this.outputBuffer.push(line);
    
    // Parse for specific event types
    try {
      // Check for JSON result
      if (this.patterns.jsonResult.test(trimmed)) {
        const resultEvent = this.parseJsonResult(trimmed);
        if (resultEvent) events.push(resultEvent);
      }
      
      // Check for tool usage
      const toolEvents = this.parseToolUsage(trimmed);
      events.push(...toolEvents);
      
      // Check for messages
      const messageEvent = this.parseMessage(trimmed);
      if (messageEvent) events.push(messageEvent);
      
      // Check for errors
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
   * Parse JSON result from Claude output
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
      // Not JSON or failed to parse
    }
    return null;
  }
  
  /**
   * Parse tool usage from output
   */
  private parseToolUsage(line: string): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    
    // Check for bash command
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
    
    // Check for file operations
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
    
    // Check for generic tool calls
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
    
    // Check if this is a tool result (end of tool use)
    if (this.patterns.toolResult.test(line) && this.toolContexts.size > 0) {
      // End the most recent tool
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
   * Parse message from output
   */
  private parseMessage(line: string): ClaudeEvent | null {
    // Check if this looks like an assistant message
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
   * Parse error from output
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
   * End any open tool contexts and return the full output
   */
  endParsing(): { events: ClaudeEvent[]; output: string } {
    const events: ClaudeEvent[] = [];
    
    // End any open tools
    for (const context of this.toolContexts.values()) {
      const duration = Date.now() - context.startTime;
      events.push(createToolEnd(
        this.sessionId,
        context.toolName,
        context.toolId,
        duration,
        false, // marked as failed since it didn't complete normally
        this.taskId,
        undefined,
        'Tool did not complete normally'
      ));
    }
    
    this.toolContexts.clear();
    
    // Return full output
    return {
      events,
      output: this.outputBuffer.join('\n')
    };
  }
}