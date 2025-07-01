/**
 * @fileoverview Modern Claude Code service implementation
 * @module services/claude-code/claude-code-service
 * @since 1.0.0
 * 
 * @remarks
 * This service provides the main interface for interacting with Claude Code CLI.
 * It manages Claude sessions, executes queries, and tracks task progress.
 * The service can operate in two modes:
 * 1. Direct SDK mode when ANTHROPIC_API_KEY is available
 * 2. Host proxy mode when using the system Claude installation
 * 
 * @example
 * ```typescript
 * import { ClaudeCodeService } from './services/claude-code';
 * 
 * const service = ClaudeCodeService.getInstance();
 * 
 * // Create a session
 * const sessionId = await service.createSession({
 *   workingDirectory: '/path/to/project',
 *   branch: 'feature/new-feature'
 * });
 * 
 * // Execute a query
 * const result = await service.querySync(
 *   sessionId,
 *   'Implement user authentication'
 * );
 * ```
 */

import { EventEmitter } from 'events';
import type { 
  ClaudeCodeSession, 
  ClaudeCodeOptions, 
  ProgressEvent,
  StreamEvent 
} from './types.js';
import { ClaudeEvent, ClaudeEventType } from '../../types/claude-events.js';
import { SessionNotReadyError } from './errors.js';
import { ENV_VARS } from './constants.js';
import { SessionManager } from './session-manager.js';
import { HostProxyClient } from './host-proxy-client.js';
import { QueryExecutor } from './query-executor.js';
import { ProgressTracker } from './progress-tracker.js';
import { logger } from '../../utils/logger.js';

/**
 * Event types emitted by ClaudeCodeService
 * 
 * @interface ClaudeCodeServiceEvents
 * @since 1.0.0
 */
export interface ClaudeCodeServiceEvents {
  /**
   * Emitted when a new session is created
   */
  'session:created': { sessionId: string };
  
  /**
   * Emitted when a session becomes ready
   */
  'session:ready': { sessionId: string };
  
  /**
   * Emitted when a session is terminated
   */
  'session:terminated': { sessionId: string };
  
  /**
   * Emitted when task progress is updated
   */
  'task:progress': ProgressEvent;
  
  /**
   * Emitted when streaming data is received
   */
  'stream:data': StreamEvent;
  
  /**
   * Emitted when Claude events are received
   */
  'claude:event': ClaudeEvent;
}

/**
 * Main service for interacting with Claude Code CLI
 * 
 * @class ClaudeCodeService
 * @extends EventEmitter
 * @since 1.0.0
 * 
 * @remarks
 * This service implements a singleton pattern and provides:
 * - Session management for Claude instances
 * - Query execution with streaming support
 * - Task progress tracking
 * - Event-driven architecture for real-time updates
 * - Support for both SDK and host proxy modes
 */
export class ClaudeCodeService extends EventEmitter {
  private static instance: ClaudeCodeService;
  private readonly sessionManager: SessionManager;
  private readonly hostProxyClient: HostProxyClient;
  private readonly queryExecutor: QueryExecutor;
  private progressTracker?: ProgressTracker;
  private readonly useHostProxy: boolean;

  /**
   * Private constructor for singleton pattern
   * 
   * @private
   * @since 1.0.0
   */
  private constructor() {
    super();
    this.sessionManager = new SessionManager();
    this.hostProxyClient = new HostProxyClient();
    this.queryExecutor = new QueryExecutor();
    
    // Check if we should use host proxy
    this.useHostProxy = !process.env[ENV_VARS.ANTHROPIC_API_KEY];
    
    logger.info('Claude Code service initialized', { 
      useHostProxy: this.useHostProxy 
    });
  }

  /**
   * Gets the singleton instance of ClaudeCodeService
   * 
   * @returns The singleton instance
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const service = ClaudeCodeService.getInstance();
   * ```
   */
  static getInstance(): ClaudeCodeService {
    if (!ClaudeCodeService.instance) {
      ClaudeCodeService.instance = new ClaudeCodeService();
    }
    return ClaudeCodeService.instance;
  }

  /**
   * Gets or creates the progress tracker
   * 
   * @private
   * @returns The progress tracker instance
   * @since 1.0.0
   */
  private async getProgressTracker(): Promise<ProgressTracker> {
    if (!this.progressTracker) {
      const { TaskStore } = await import('../task-store.js');
      this.progressTracker = new ProgressTracker(TaskStore.getInstance());
    }
    return this.progressTracker;
  }

  /**
   * Creates a new session
   * 
   * @param options - Options for the Claude session
   * @returns The session ID
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const sessionId = await service.createSession({
   *   workingDirectory: '/home/user/project',
   *   branch: 'main',
   *   customSystemPrompt: 'You are a helpful coding assistant'
   * });
   * ```
   */
  async createSession(options: ClaudeCodeOptions = {}): Promise<string> {
    const session = this.sessionManager.createSession(options);
    
    this.emit('session:created', { sessionId: session.id });
    this.emit('session:ready', { sessionId: session.id });
    
    return session.id;
  }

  /**
   * Sets task ID for a session
   * 
   * @param sessionId - The session ID
   * @param taskId - The task ID to associate
   * @since 1.0.0
   */
  setTaskId(sessionId: string, taskId: string): void {
    this.sessionManager.setTaskId(sessionId, taskId);
  }

  /**
   * Sets MCP session ID for a session
   * 
   * @param sessionId - The session ID
   * @param mcpSessionId - The MCP session ID to associate
   * @since 1.0.0
   */
  setMcpSessionId(sessionId: string, mcpSessionId: string): void {
    this.sessionManager.setMcpSessionId(sessionId, mcpSessionId);
  }

  /**
   * Finds a session by ID
   * 
   * @param sessionId - The session ID to find
   * @returns The session if found, undefined otherwise
   * @since 1.0.0
   */
  findSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessionManager.findSession(sessionId);
  }

  /**
   * Executes a query synchronously
   * 
   * @param sessionId - The session ID
   * @param prompt - The prompt to send to Claude
   * @param options - Optional query options
   * @returns The response from Claude
   * @throws {SessionNotReadyError} If session is not ready
   * @since 1.0.0
   * 
   * @remarks
   * This method will:
   * 1. Check session readiness
   * 2. Execute via SDK or host proxy based on configuration
   * 3. Track progress if a task is associated
   * 4. Emit appropriate events during execution
   * 
   * @example
   * ```typescript
   * try {
   *   const response = await service.querySync(
   *     sessionId,
   *     'Implement a REST API endpoint for user creation',
   *     { maxTurns: 20 }
   *   );
   *   console.log('Claude response:', response);
   * } catch (error) {
   *   if (error instanceof SessionNotReadyError) {
   *     console.error('Session not ready');
   *   }
   * }
   * ```
   */
  async querySync(
    sessionId: string, 
    prompt: string, 
    options?: Partial<ClaudeCodeOptions>
  ): Promise<string> {
    const session = this.sessionManager.getSession(sessionId);
    
    logger.info('Query requested', {
      sessionId,
      status: session.status,
      promptLength: prompt.length,
      workingDirectory: session.workingDirectory,
      useHostProxy: this.useHostProxy
    });

    if (session.status !== 'ready' && session.status !== 'busy') {
      throw new SessionNotReadyError(sessionId, session.status);
    }

    this.sessionManager.updateStatus(sessionId, 'busy');

    try {
      let result: string;

      if (this.useHostProxy) {
        result = await this.executeViaHostProxy(session, prompt);
      } else {
        const queryResult = await this.queryExecutor.execute(session, prompt, options);
        result = queryResult.content;
        
        if (session.taskId) {
          const tracker = await this.getProgressTracker();
          for (const message of queryResult.messages) {
            if (message.type === 'assistant' && message.message?.content) {
              await tracker.logAssistantMessage(session.taskId, message.message.content, session.mcpSessionId);
            }
          }
        }
      }

      this.sessionManager.updateStatus(sessionId, 'ready');
      return result;
    } catch (error) {
      this.sessionManager.updateStatus(sessionId, 'error');
      session.errorBuffer.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Executes via host proxy
   * 
   * @private
   * @param session - The Claude session
   * @param prompt - The prompt to execute
   * @returns The response from Claude
   * @since 1.0.0
   * 
   * @remarks
   * This method handles execution through the host proxy when
   * ANTHROPIC_API_KEY is not available. It:
   * 1. Sets up environment variables for the Claude process
   * 2. Executes the command via the host proxy
   * 3. Handles streaming data and events
   * 4. Tracks progress if a task is associated
   */
  private async executeViaHostProxy(
    session: ClaudeCodeSession, 
    prompt: string
  ): Promise<string> {
    const tracker = await this.getProgressTracker();

    const env: Record<string, string> = {};
    if (session.taskId) {
      const { AgentManager } = await import('../agent-manager/index.js');
      const agentManager = AgentManager.getInstance();
      const sessions = agentManager.getAllSessions();
      const agentSession = sessions.find(s => s.taskId === session.taskId);
      
      if (agentSession) {
        env.CLAUDE_SESSION_ID = agentSession.id;
        logger.info('Setting CLAUDE_SESSION_ID for task', { 
          taskId: session.taskId, 
          sessionId: agentSession.id 
        });
      }
    }

    const result = await this.hostProxyClient.execute(
      prompt,
      session.workingDirectory,
      async (data: string) => {
        session.streamBuffer.push(data);
        
        this.emit('stream:data', {
          sessionId: session.id,
          data,
          taskId: session.taskId
        });

        if (session.taskId) {
          await tracker.parseProgressFromStream(session, data);
        }
      },
      env,
      session.id,
      session.taskId,
      (event: ClaudeEvent) => {
        this.emit('claude:event', event);
        
        if (session.taskId) {
          this.logEventToTask(session, event);
        }
      }
    );

    session.outputBuffer.push({
      type: 'assistant',
      message: { content: [{ type: 'text', text: result }] }
    } as any);

    return result;
  }

  /**
   * Ends a session
   * 
   * @param sessionId - The session ID to end
   * @since 1.0.0
   */
  async endSession(sessionId: string): Promise<void> {
    this.sessionManager.endSession(sessionId);
    this.emit('session:terminated', { sessionId });
  }

  /**
   * Gets a session
   * 
   * @param sessionId - The session ID to retrieve
   * @returns The session if found, undefined otherwise
   * @since 1.0.0
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessionManager.findSession(sessionId);
  }

  /**
   * Gets all sessions
   * 
   * @returns Array of all Claude sessions
   * @since 1.0.0
   */
  getAllSessions(): ClaudeCodeSession[] {
    return this.sessionManager.getAllSessions();
  }

  /**
   * Gets service metrics
   * 
   * @returns Service metrics including session counts
   * @since 1.0.0
   */
  getMetrics() {
    return this.sessionManager.getMetrics();
  }

  /**
   * Cleans up old sessions
   * 
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Number of sessions cleaned up
   * @since 1.0.0
   */
  cleanupOldSessions(maxAgeMs?: number): number {
    return this.sessionManager.cleanupOldSessions(maxAgeMs);
  }

  /**
   * Type-safe event emitter
   * 
   * @template K - Event name
   * @param event - The event to emit
   * @param args - Event arguments
   * @returns True if event had listeners
   * @since 1.0.0
   */
  emit<K extends keyof ClaudeCodeServiceEvents>(
    event: K,
    ...args: ClaudeCodeServiceEvents[K] extends void ? [] : [ClaudeCodeServiceEvents[K]]
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe event listener registration
   * 
   * @template K - Event name
   * @param event - The event to listen for
   * @param listener - The callback function
   * @returns This instance for chaining
   * @since 1.0.0
   */
  on<K extends keyof ClaudeCodeServiceEvents>(
    event: K,
    listener: (arg: ClaudeCodeServiceEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event listener removal
   * 
   * @template K - Event name
   * @param event - The event to stop listening for
   * @param listener - The callback function to remove
   * @returns This instance for chaining
   * @since 1.0.0
   */
  off<K extends keyof ClaudeCodeServiceEvents>(
    event: K,
    listener: (arg: ClaudeCodeServiceEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
  
  /**
   * Log Claude events to task
   * 
   * @private
   * @param session - The Claude session
   * @param event - The Claude event to log
   * @since 1.0.0
   * 
   * @remarks
   * Maps Claude event types to task log entries with appropriate
   * log levels and types. Skips stream events to avoid verbosity.
   */
  private async logEventToTask(session: ClaudeCodeSession, event: ClaudeEvent): Promise<void> {
    const { TaskStore } = await import('../task-store.js');
    const taskStore = TaskStore.getInstance();
    
    const eventTypeMap: Record<ClaudeEventType, { logType: string; level: string; prefix?: string }> = {
      [ClaudeEventType.ProcessStart]: { logType: 'system', level: 'info', prefix: 'PROCESS_START' },
      [ClaudeEventType.ProcessEnd]: { logType: 'system', level: 'info', prefix: 'PROCESS_END' },
      [ClaudeEventType.ToolStart]: { logType: 'tool', level: 'info', prefix: 'TOOL_START' },
      [ClaudeEventType.ToolEnd]: { logType: 'tool', level: 'info', prefix: 'TOOL_END' },
      [ClaudeEventType.Message]: { logType: 'agent', level: 'info' },
      [ClaudeEventType.Stream]: { logType: 'output', level: 'debug' },
      [ClaudeEventType.Error]: { logType: 'error', level: 'error', prefix: 'ERROR' },
      [ClaudeEventType.Result]: { logType: 'output', level: 'info', prefix: 'RESULT' },
    };
    
    const mapping = eventTypeMap[event.type];
    if (!mapping) return;
    
    if (event.type === ClaudeEventType.Stream) return;
    
    let level = mapping.level;
    if (event.type === ClaudeEventType.ProcessEnd && event.metadata?.exitCode !== 0) {
      level = 'error';
    }
    if (event.type === ClaudeEventType.ToolEnd && event.metadata?.success === false) {
      level = 'error';
    }
    
    await taskStore.addLog(session.taskId!, {
      timestamp: event.timestamp,
      level: level as any,
      type: mapping.logType as any,
      prefix: mapping.prefix,
      message: event.content,
      metadata: event.metadata
    }, session.mcpSessionId);
  }
}