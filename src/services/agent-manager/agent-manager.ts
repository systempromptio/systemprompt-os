/**
 * @fileoverview Modern Agent Manager implementation
 * @module services/agent-manager/agent-manager
 * 
 * @remarks
 * This module provides a centralized manager for AI agent sessions,
 * supporting Claude Code and potentially other AI agents. It handles
 * session lifecycle, command routing, and event coordination.
 * 
 * @example
 * ```typescript
 * import { AgentManager } from './services/agent-manager';
 * 
 * const manager = AgentManager.getInstance();
 * 
 * // Start a Claude session
 * const sessionId = await manager.startClaudeSession({
 *   task_id: 'task-123',
 *   project_path: '/path/to/project',
 *   instructions: 'Build a login form'
 * });
 * 
 * // Send a command
 * const result = await manager.sendCommand(sessionId, {
 *   command: 'Add validation to the form',
 *   timeout: 30000
 * });
 * ```
 */

import { EventEmitter } from 'events';
import type {
  AgentSession,
  AgentCommand,
  AgentCommandResult,
  ClaudeSessionConfig,
  SessionEvent,
  TaskProgressEvent,
  AgentType
} from './types.js';
import { canAcceptCommands } from '../../types/session-states.js';
import { 
  SessionNotFoundError, 
  UnknownSessionTypeError 
} from './errors.js';
import { ERROR_CODES } from './constants.js';
import { SessionStore } from './session-store.js';
import { TaskLogger } from './task-logger.js';
import { ClaudeSessionManager } from './claude-session-manager.js';
import { logger } from '../../utils/logger.js';

/**
 * Event types emitted by the AgentManager
 * 
 * @interface AgentManagerEvents
 */
export interface AgentManagerEvents {
  /**
   * Emitted when a new session is created
   */
  'session:created': SessionEvent;
  
  /**
   * Emitted when a session becomes ready
   */
  'session:ready': string;
  
  /**
   * Emitted when task progress is reported
   */
  'task:progress': TaskProgressEvent;
}

/**
 * Manages agent sessions and coordinates between different agent types
 * 
 * @class AgentManager
 * @extends EventEmitter
 * 
 * @remarks
 * This class implements a singleton pattern and provides:
 * - Session lifecycle management (create, send commands, end)
 * - Support for multiple agent types (currently Claude)
 * - Event-driven architecture for session and task updates
 * - Thread-safe session storage and state management
 * - Automatic cleanup of terminated sessions
 */
export class AgentManager extends EventEmitter {
  private static instance: AgentManager;
  private readonly sessionStore: SessionStore;
  private taskLogger!: TaskLogger;
  private claudeManager!: ClaudeSessionManager;

  /**
   * Private constructor for singleton pattern
   * 
   * @private
   */
  private constructor() {
    super();
    
    this.sessionStore = new SessionStore();
    
    // Lazy load dependencies to avoid circular imports
    const getTaskStore = async () => {
      const { TaskStore } = await import('../task-store.js');
      return TaskStore.getInstance();
    };

    const getClaudeService = async () => {
      const { ClaudeCodeService } = await import('../claude-code/index.js');
      return ClaudeCodeService.getInstance();
    };

    // Initialize managers with lazy-loaded dependencies
    Promise.all([getTaskStore(), getClaudeService()]).then(
      ([taskStore, claudeService]) => {
        this.taskLogger = new TaskLogger(taskStore);
        
        this.claudeManager = new ClaudeSessionManager(
          claudeService,
          this.sessionStore,
          this.taskLogger
        );

        this.setupServiceListeners();
      }
    );
  }

  /**
   * Gets the singleton instance of AgentManager
   * 
   * @returns The singleton AgentManager instance
   * 
   * @example
   * ```typescript
   * const manager = AgentManager.getInstance();
   * ```
   */
  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Sets up service event listeners
   * 
   * @private
   */
  private setupServiceListeners(): void {
    const handleSessionReady = (serviceSessionId: string) => {
      const session = this.sessionStore.findSessionByServiceId(serviceSessionId);
      if (session) {
        this.sessionStore.updateStatus(session.id, 'active');
        this.emit('session:ready', session.id);
      }
    };

    this.claudeManager.setupEventListeners(handleSessionReady);

    import('../claude-code/index.js').then(({ ClaudeCodeService }) => {
      const claudeService = ClaudeCodeService.getInstance();
      claudeService.on('task:progress', (progress: TaskProgressEvent) => {
        this.emit('task:progress', progress);
        
        const sessions = this.sessionStore.getAllSessions();
        const session = sessions.find(s => s.taskId === progress.taskId);
        if (session) {
          this.sessionStore.updateActivity(session.id);
        }
      });
    });
  }

  /**
   * Starts a Claude session
   * 
   * @param config - Configuration for the Claude session
   * @returns The session ID
   * 
   * @example
   * ```typescript
   * const sessionId = await manager.startClaudeSession({
   *   task_id: 'task-123',
   *   project_path: '/home/user/project',
   *   instructions: 'Implement user authentication'
   * });
   * ```
   */
  async startClaudeSession(config: ClaudeSessionConfig): Promise<string> {
    const sessionId = await this.claudeManager.startSession(config);
    
    this.emit('session:created', { 
      sessionId, 
      type: 'claude' 
    });

    logger.info('Claude agent session created', {
      sessionId,
      projectPath: config.project_path,
      taskId: config.task_id
    });

    return sessionId;
  }


  /**
   * Sends a command to an agent
   * 
   * @param sessionId - The session ID to send the command to
   * @param command - The command to send
   * @returns Result of the command execution
   * @throws {SessionNotFoundError} If session doesn't exist
   * @throws {UnknownSessionTypeError} If session type is not supported
   * 
   * @example
   * ```typescript
   * const result = await manager.sendCommand(sessionId, {
   *   command: 'Add form validation',
   *   timeout: 30000
   * });
   * 
   * if (result.success) {
   *   console.log('Command executed successfully');
   * } else {
   *   console.error('Command failed:', result.error);
   * }
   * ```
   */
  async sendCommand(
    sessionId: string, 
    command: AgentCommand
  ): Promise<AgentCommandResult> {
    const session = this.sessionStore.findSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (!canAcceptCommands(session.status)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.SESSION_NOT_ACTIVE,
          message: `Session is ${session.status}`,
          retryable: false
        },
        duration: 0
      };
    }

    this.sessionStore.updateStatus(sessionId, 'busy');

    try {
      let result: AgentCommandResult;

      switch (session.type) {
        case 'claude':
          result = await this.claudeManager.sendCommand(
            session, 
            command.command, 
            command.timeout
          );
          break;

        default:
          throw new UnknownSessionTypeError(session.type);
      }

      this.sessionStore.updateStatus(sessionId, 'active');
      return result;

    } catch (error) {
      this.sessionStore.updateStatus(sessionId, 'active');
      throw error;
    }
  }

  /**
   * Ends an agent session
   * 
   * @param sessionId - The session ID to end
   * @returns True if session was ended successfully, false otherwise
   * 
   * @example
   * ```typescript
   * const ended = await manager.endSession(sessionId);
   * if (ended) {
   *   console.log('Session ended successfully');
   * }
   * ```
   */
  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessionStore.findSession(sessionId);
    if (!session) return false;

    try {
      if (session.taskId) {
        await this.taskLogger.logError(
          session.taskId,
          '',
          `Ending session`
        );
      }

      switch (session.type) {
        case 'claude':
          await this.claudeManager.endSession(session);
          break;

        default:
          throw new UnknownSessionTypeError(session.type);
      }

      this.sessionStore.updateStatus(sessionId, 'terminated');
      this.sessionStore.deleteSession(sessionId);

      logger.info('Agent session ended', {
        sessionId,
        type: session.type
      });

      return true;
    } catch (error) {
      logger.error('Error ending session', {
        sessionId,
        type: session.type,
        error
      });
      return false;
    }
  }

  /**
   * Gets a session by ID
   * 
   * @param sessionId - The session ID to retrieve
   * @returns The session if found, null otherwise
   * 
   * @example
   * ```typescript
   * const session = manager.getSession(sessionId);
   * if (session) {
   *   console.log(`Session status: ${session.status}`);
   * }
   * ```
   */
  getSession(sessionId: string): AgentSession | null {
    return this.sessionStore.findSession(sessionId);
  }

  /**
   * Gets all sessions
   * 
   * @returns Array of all active sessions
   * 
   * @example
   * ```typescript
   * const sessions = manager.getAllSessions();
   * console.log(`Active sessions: ${sessions.length}`);
   * ```
   */
  getAllSessions(): AgentSession[] {
    return this.sessionStore.getAllSessions();
  }

  /**
   * Gets sessions by type
   * 
   * @param type - The agent type to filter by
   * @returns Array of sessions for the specified type
   * 
   * @example
   * ```typescript
   * const claudeSessions = manager.getSessionsByType('claude');
   * console.log(`Claude sessions: ${claudeSessions.length}`);
   * ```
   */
  getSessionsByType(type: AgentType): AgentSession[] {
    return this.sessionStore.getSessionsByType(type);
  }

  /**
   * Gets session metrics
   * 
   * @returns Object containing session metrics
   * 
   * @example
   * ```typescript
   * const metrics = manager.getMetrics();
   * console.log(`Total sessions: ${metrics.total}`);
   * console.log(`Active sessions: ${metrics.active}`);
   * ```
   */
  getMetrics() {
    return this.sessionStore.getMetrics();
  }

  /**
   * Type-safe event emitter
   * 
   * @template K - Event name from AgentManagerEvents
   * @param event - The event to emit
   * @param args - Event arguments
   * @returns True if the event had listeners, false otherwise
   */
  emit<K extends keyof AgentManagerEvents>(
    event: K,
    ...args: AgentManagerEvents[K] extends void ? [] : [AgentManagerEvents[K]]
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe event listener registration
   * 
   * @template K - Event name from AgentManagerEvents
   * @param event - The event to listen for
   * @param listener - The callback function
   * @returns This instance for method chaining
   * 
   * @example
   * ```typescript
   * manager.on('session:created', (event) => {
   *   console.log(`New ${event.type} session: ${event.sessionId}`);
   * });
   * ```
   */
  on<K extends keyof AgentManagerEvents>(
    event: K,
    listener: (arg: AgentManagerEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event listener removal
   * 
   * @template K - Event name from AgentManagerEvents
   * @param event - The event to stop listening for
   * @param listener - The callback function to remove
   * @returns This instance for method chaining
   */
  off<K extends keyof AgentManagerEvents>(
    event: K,
    listener: (arg: AgentManagerEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
}