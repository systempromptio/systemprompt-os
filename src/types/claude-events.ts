/**
 * @fileoverview Simplified, strongly-typed Claude event system
 * @module types/claude-events
 * @since 1.0.0
 */

/**
 * Claude event types enumeration
 * @enum {string}
 * @since 1.0.0
 */
export enum ClaudeEventType {
  /** Process start event */
  ProcessStart = 'process:start',
  /** Process end event */
  ProcessEnd = 'process:end',
  /** Tool execution start event */
  ToolStart = 'tool:start',
  /** Tool execution end event */
  ToolEnd = 'tool:end',
  /** Message event */
  Message = 'message',
  /** Stream output event */
  Stream = 'stream',
  /** Error event */
  Error = 'error',
  /** Result event */
  Result = 'result'
}

/**
 * Base Claude event interface - minimal and consistent
 * @interface
 * @since 1.0.0
 */
export interface ClaudeEvent {
  /**
   * Event type
   * @since 1.0.0
   */
  type: ClaudeEventType;
  
  /**
   * ISO timestamp when event occurred
   * @since 1.0.0
   */
  timestamp: string;
  
  /**
   * Session identifier
   * @since 1.0.0
   */
  sessionId: string;
  
  /**
   * Optional task identifier
   * @since 1.0.0
   */
  taskId?: string;
  
  /**
   * Event content/message
   * @since 1.0.0
   */
  content: string;
  
  /**
   * Event-specific metadata
   * @since 1.0.0
   */
  metadata?: Record<string, any>;
}

/**
 * Metadata for process start events
 * @interface
 * @since 1.0.0
 */
export interface ProcessStartMetadata {
  /**
   * Process ID
   * @since 1.0.0
   */
  pid: number;
  
  /**
   * Command that was executed
   * @since 1.0.0
   */
  command: string;
  
  /**
   * Working directory path
   * @since 1.0.0
   */
  workingDirectory: string;
  
  /**
   * Environment variables
   * @since 1.0.0
   */
  environment?: Record<string, string>;
}

/**
 * Metadata for process end events
 * @interface
 * @since 1.0.0
 */
export interface ProcessEndMetadata {
  /**
   * Process exit code (null if terminated by signal)
   * @since 1.0.0
   */
  exitCode: number | null;
  
  /**
   * Termination signal (null if exited normally)
   * @since 1.0.0
   */
  signal: string | null;
  
  /**
   * Process duration in milliseconds
   * @since 1.0.0
   */
  duration: number;
  
  /**
   * Full stdout/stderr output
   * @since 1.0.0
   */
  output?: string;
}

/**
 * Metadata for tool start events
 * @interface
 * @since 1.0.0
 */
export interface ToolStartMetadata {
  /**
   * Name of the tool being executed
   * @since 1.0.0
   */
  toolName: string;
  
  /**
   * Unique tool execution identifier
   * @since 1.0.0
   */
  toolId: string;
  
  /**
   * Tool parameters
   * @since 1.0.0
   */
  parameters: Record<string, any>;
}

/**
 * Metadata for tool end events
 * @interface
 * @since 1.0.0
 */
export interface ToolEndMetadata {
  /**
   * Name of the tool that was executed
   * @since 1.0.0
   */
  toolName: string;
  
  /**
   * Unique tool execution identifier
   * @since 1.0.0
   */
  toolId: string;
  
  /**
   * Tool execution duration in milliseconds
   * @since 1.0.0
   */
  duration: number;
  
  /**
   * Whether the tool execution succeeded
   * @since 1.0.0
   */
  success: boolean;
  
  /**
   * Tool execution result
   * @since 1.0.0
   */
  result?: any;
  
  /**
   * Error message if tool failed
   * @since 1.0.0
   */
  error?: string;
}

/**
 * Metadata for message events
 * @interface
 * @since 1.0.0
 */
export interface MessageMetadata {
  /**
   * Message role
   * @since 1.0.0
   */
  role: 'assistant' | 'user' | 'system';
  
  /**
   * Token count for the message
   * @since 1.0.0
   */
  tokens?: number;
  
  /**
   * Model used for generation
   * @since 1.0.0
   */
  model?: string;
}

/**
 * Metadata for stream events
 * @interface
 * @since 1.0.0
 */
export interface StreamMetadata {
  /**
   * Type of output stream
   * @since 1.0.0
   */
  streamType: 'stdout' | 'stderr';
}

/**
 * Metadata for error events
 * @interface
 * @since 1.0.0
 */
export interface ErrorMetadata {
  /**
   * Error code
   * @since 1.0.0
   */
  code?: string;
  
  /**
   * Error stack trace
   * @since 1.0.0
   */
  stack?: string;
}

/**
 * Metadata for result events
 * @interface
 * @since 1.0.0
 */
export interface ResultMetadata {
  /**
   * Whether the operation succeeded
   * @since 1.0.0
   */
  success: boolean;
  
  /**
   * Total duration in milliseconds
   * @since 1.0.0
   */
  duration: number;
  
  /**
   * Estimated cost in USD
   * @since 1.0.0
   */
  cost?: number;
  
  /**
   * Token usage statistics
   * @since 1.0.0
   */
  usage?: {
    /**
     * Input tokens consumed
     * @since 1.0.0
     */
    inputTokens: number;
    
    /**
     * Output tokens generated
     * @since 1.0.0
     */
    outputTokens: number;
    
    /**
     * Cached tokens used
     * @since 1.0.0
     */
    cacheTokens?: number;
  };
}

/**
 * Type guard for process start events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a process start event
 * @since 1.0.0
 */
export function isProcessStart(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.ProcessStart;
}

/**
 * Type guard for process end events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a process end event
 * @since 1.0.0
 */
export function isProcessEnd(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.ProcessEnd;
}

/**
 * Type guard for tool start events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a tool start event
 * @since 1.0.0
 */
export function isToolStart(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.ToolStart;
}

/**
 * Type guard for tool end events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a tool end event
 * @since 1.0.0
 */
export function isToolEnd(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.ToolEnd;
}

/**
 * Type guard for message events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a message event
 * @since 1.0.0
 */
export function isMessage(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.Message;
}

/**
 * Type guard for stream events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a stream event
 * @since 1.0.0
 */
export function isStream(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.Stream;
}

/**
 * Type guard for error events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is an error event
 * @since 1.0.0
 */
export function isError(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.Error;
}

/**
 * Type guard for result events
 * @param {ClaudeEvent} event - Event to check
 * @returns {boolean} True if event is a result event
 * @since 1.0.0
 */
export function isResult(event: ClaudeEvent): boolean {
  return event.type === ClaudeEventType.Result;
}

/**
 * Creates a generic Claude event
 * @param {ClaudeEventType} type - Event type
 * @param {string} sessionId - Session identifier
 * @param {string} content - Event content
 * @param {Record<string, any>} [metadata] - Event metadata
 * @param {string} [taskId] - Optional task identifier
 * @returns {ClaudeEvent} Created event
 * @since 1.0.0
 */
export function createEvent(
  type: ClaudeEventType,
  sessionId: string,
  content: string,
  metadata?: Record<string, any>,
  taskId?: string
): ClaudeEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    sessionId,
    taskId,
    content,
    metadata
  };
}

/**
 * Creates a process start event
 * @param {string} sessionId - Session identifier
 * @param {number} pid - Process ID
 * @param {string} command - Command being executed
 * @param {string} workingDirectory - Working directory path
 * @param {string} [taskId] - Optional task identifier
 * @param {Record<string, string>} [environment] - Environment variables
 * @returns {ClaudeEvent} Process start event
 * @since 1.0.0
 */
export function createProcessStart(
  sessionId: string,
  pid: number,
  command: string,
  workingDirectory: string,
  taskId?: string,
  environment?: Record<string, string>
): ClaudeEvent {
  const metadata: ProcessStartMetadata = {
    pid,
    command,
    workingDirectory,
    environment
  };
  
  return createEvent(
    ClaudeEventType.ProcessStart,
    sessionId,
    `Starting Claude process (PID: ${pid})`,
    metadata,
    taskId
  );
}

/**
 * Creates a process end event
 * @param {string} sessionId - Session identifier
 * @param {number | null} exitCode - Process exit code
 * @param {string | null} signal - Termination signal
 * @param {number} duration - Process duration in milliseconds
 * @param {string} output - Process output
 * @param {string} [taskId] - Optional task identifier
 * @returns {ClaudeEvent} Process end event
 * @since 1.0.0
 */
export function createProcessEnd(
  sessionId: string,
  exitCode: number | null,
  signal: string | null,
  duration: number,
  output: string,
  taskId?: string
): ClaudeEvent {
  const metadata: ProcessEndMetadata = {
    exitCode,
    signal,
    duration,
    output
  };
  
  return createEvent(
    ClaudeEventType.ProcessEnd,
    sessionId,
    `Process ended (exit: ${exitCode ?? 'signal'}, ${duration}ms)`,
    metadata,
    taskId
  );
}

/**
 * Creates a tool start event
 * @param {string} sessionId - Session identifier
 * @param {string} toolName - Name of the tool
 * @param {string} toolId - Unique tool execution ID
 * @param {Record<string, any>} parameters - Tool parameters
 * @param {string} [taskId] - Optional task identifier
 * @returns {ClaudeEvent} Tool start event
 * @since 1.0.0
 */
export function createToolStart(
  sessionId: string,
  toolName: string,
  toolId: string,
  parameters: Record<string, any>,
  taskId?: string
): ClaudeEvent {
  const metadata: ToolStartMetadata = {
    toolName,
    toolId,
    parameters
  };
  
  return createEvent(
    ClaudeEventType.ToolStart,
    sessionId,
    `Starting ${toolName}`,
    metadata,
    taskId
  );
}

/**
 * Creates a tool end event
 * @param {string} sessionId - Session identifier
 * @param {string} toolName - Name of the tool
 * @param {string} toolId - Unique tool execution ID
 * @param {number} duration - Execution duration in milliseconds
 * @param {boolean} success - Whether execution succeeded
 * @param {string} [taskId] - Optional task identifier
 * @param {any} [result] - Tool execution result
 * @param {string} [error] - Error message if failed
 * @returns {ClaudeEvent} Tool end event
 * @since 1.0.0
 */
export function createToolEnd(
  sessionId: string,
  toolName: string,
  toolId: string,
  duration: number,
  success: boolean,
  taskId?: string,
  result?: any,
  error?: string
): ClaudeEvent {
  const metadata: ToolEndMetadata = {
    toolName,
    toolId,
    duration,
    success,
    result,
    error
  };
  
  return createEvent(
    ClaudeEventType.ToolEnd,
    sessionId,
    `${toolName} ${success ? 'completed' : 'failed'} (${duration}ms)`,
    metadata,
    taskId
  );
}

/**
 * Creates a message event
 * @param {string} sessionId - Session identifier
 * @param {'assistant' | 'user' | 'system'} role - Message role
 * @param {string} content - Message content
 * @param {string} [taskId] - Optional task identifier
 * @param {number} [tokens] - Token count
 * @param {string} [model] - Model used
 * @returns {ClaudeEvent} Message event
 * @since 1.0.0
 */
export function createMessage(
  sessionId: string,
  role: 'assistant' | 'user' | 'system',
  content: string,
  taskId?: string,
  tokens?: number,
  model?: string
): ClaudeEvent {
  const metadata: MessageMetadata = {
    role,
    tokens,
    model
  };
  
  return createEvent(
    ClaudeEventType.Message,
    sessionId,
    content,
    metadata,
    taskId
  );
}

/**
 * Creates a stream event
 * @param {string} sessionId - Session identifier
 * @param {string} data - Stream data
 * @param {'stdout' | 'stderr'} streamType - Stream type
 * @param {string} [taskId] - Optional task identifier
 * @returns {ClaudeEvent} Stream event
 * @since 1.0.0
 */
export function createStream(
  sessionId: string,
  data: string,
  streamType: 'stdout' | 'stderr',
  taskId?: string
): ClaudeEvent {
  const metadata: StreamMetadata = {
    streamType
  };
  
  return createEvent(
    ClaudeEventType.Stream,
    sessionId,
    data,
    metadata,
    taskId
  );
}

/**
 * Creates an error event
 * @param {string} sessionId - Session identifier
 * @param {string} error - Error message
 * @param {string} [taskId] - Optional task identifier
 * @param {string} [code] - Error code
 * @param {string} [stack] - Stack trace
 * @returns {ClaudeEvent} Error event
 * @since 1.0.0
 */
export function createError(
  sessionId: string,
  error: string,
  taskId?: string,
  code?: string,
  stack?: string
): ClaudeEvent {
  const metadata: ErrorMetadata = {
    code,
    stack
  };
  
  return createEvent(
    ClaudeEventType.Error,
    sessionId,
    error,
    metadata,
    taskId
  );
}

/**
 * Creates a result event
 * @param {string} sessionId - Session identifier
 * @param {string} result - Result description
 * @param {boolean} success - Whether operation succeeded
 * @param {number} duration - Total duration in milliseconds
 * @param {string} [taskId] - Optional task identifier
 * @param {number} [cost] - Estimated cost in USD
 * @param {{ inputTokens: number; outputTokens: number; cacheTokens?: number }} [usage] - Token usage
 * @returns {ClaudeEvent} Result event
 * @since 1.0.0
 */
export function createResult(
  sessionId: string,
  result: string,
  success: boolean,
  duration: number,
  taskId?: string,
  cost?: number,
  usage?: { inputTokens: number; outputTokens: number; cacheTokens?: number }
): ClaudeEvent {
  const metadata: ResultMetadata = {
    success,
    duration,
    cost,
    usage
  };
  
  return createEvent(
    ClaudeEventType.Result,
    sessionId,
    result,
    metadata,
    taskId
  );
}