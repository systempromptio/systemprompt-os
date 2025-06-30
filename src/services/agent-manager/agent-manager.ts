/**
 * @file Modern Agent Manager implementation
 * @module services/agent-manager/agent-manager
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
 */
export interface AgentManagerEvents {
  'session:created': SessionEvent;
  'session:ready': string;
  'task:progress': TaskProgressEvent;
}

/**
 * Manages agent sessions and coordinates between different agent types
 */
export class AgentManager extends EventEmitter {
  private static instance: AgentManager;
  private readonly sessionStore: SessionStore;
  private taskLogger!: TaskLogger;
  private claudeManager!: ClaudeSessionManager;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
    
    this.sessionStore = new SessionStore();
    
    // Lazy load dependencies
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
   */
  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Sets up service event listeners
   */
  private setupServiceListeners(): void {
    // Handle session ready events
    const handleSessionReady = (serviceSessionId: string) => {
      const session = this.sessionStore.findSessionByServiceId(serviceSessionId);
      if (session) {
        this.sessionStore.updateStatus(session.id, 'active');
        this.emit('session:ready', session.id);
      }
    };

    this.claudeManager.setupEventListeners(handleSessionReady);

    // Handle Claude task progress events
    import('../claude-code/index.js').then(({ ClaudeCodeService }) => {
      const claudeService = ClaudeCodeService.getInstance();
      claudeService.on('task:progress', (progress: TaskProgressEvent) => {
        this.emit('task:progress', progress);
        
        // Update session activity
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
   */
  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessionStore.findSession(sessionId);
    if (!session) return false;

    try {
      // Log session ending
      if (session.taskId) {
        await this.taskLogger.logError(
          session.taskId,
          '',
          `Ending session`
        );
      }

      // End the appropriate service session
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
   */
  getSession(sessionId: string): AgentSession | null {
    return this.sessionStore.findSession(sessionId);
  }

  /**
   * Gets all sessions
   */
  getAllSessions(): AgentSession[] {
    return this.sessionStore.getAllSessions();
  }

  /**
   * Gets sessions by type
   */
  getSessionsByType(type: AgentType): AgentSession[] {
    return this.sessionStore.getSessionsByType(type);
  }

  /**
   * Gets session metrics
   */
  getMetrics() {
    return this.sessionStore.getMetrics();
  }

  /**
   * Type-safe event emitter
   */
  emit<K extends keyof AgentManagerEvents>(
    event: K,
    ...args: AgentManagerEvents[K] extends void ? [] : [AgentManagerEvents[K]]
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe event listener registration
   */
  on<K extends keyof AgentManagerEvents>(
    event: K,
    listener: (arg: AgentManagerEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event listener removal
   */
  off<K extends keyof AgentManagerEvents>(
    event: K,
    listener: (arg: AgentManagerEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
}