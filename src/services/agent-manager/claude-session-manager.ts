/**
 * @fileoverview Claude session management for Agent Manager
 * @module services/agent-manager/claude-session-manager
 * 
 * @remarks
 * This module provides specialized management for Claude Code sessions within
 * the agent manager. It handles session lifecycle, command execution, and
 * coordination between the Claude service and the agent session store.
 * 
 * @example
 * ```typescript
 * import { ClaudeSessionManager } from './claude-session-manager';
 * 
 * const manager = new ClaudeSessionManager(
 *   claudeService,
 *   sessionStore,
 *   taskLogger
 * );
 * 
 * const sessionId = await manager.startSession({
 *   task_id: 'task-123',
 *   project_path: '/path/to/project',
 *   initial_context: 'Build a REST API'
 * });
 * ```
 */

import type { ClaudeSessionConfig, AgentSession, AgentCommandResult } from './types.js';
import type { ClaudeCodeService, ClaudeCodeOptions } from '../claude-code/index.js';
import type { SessionStore } from './session-store.js';
import type { TaskLogger } from './task-logger.js';
import { DEFAULT_MAX_TURNS } from './constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Manages Claude Code sessions and their lifecycle
 * 
 * @class ClaudeSessionManager
 * 
 * @remarks
 * This class provides:
 * - Session creation with task and MCP session linking
 * - Command execution with automatic logging
 * - Session termination with cleanup
 * - Event forwarding from Claude service
 */
export class ClaudeSessionManager {
  /**
   * Creates a new Claude session manager
   * 
   * @param claudeService - The Claude Code service instance
   * @param sessionStore - The session store for managing sessions
   * @param taskLogger - The task logger for logging events
   */
  constructor(
    private readonly claudeService: ClaudeCodeService,
    private readonly sessionStore: SessionStore,
    private readonly taskLogger: TaskLogger
  ) {}

  /**
   * Starts a Claude session
   * 
   * @param config - Configuration for the Claude session
   * @returns The agent session ID
   * 
   * @remarks
   * This method:
   * 1. Creates a Claude service session with the provided options
   * 2. Links it with task and MCP session if provided
   * 3. Creates an agent session in the session store
   * 4. Logs the session creation event
   * 
   * @example
   * ```typescript
   * const sessionId = await manager.startSession({
   *   task_id: 'task-123',
   *   project_path: '/home/user/project',
   *   initial_context: 'Implement user authentication',
   *   mcp_session_id: 'mcp-456',
   *   options: {
   *     branch: 'feature/auth'
   *   }
   * });
   * ```
   */
  async startSession(config: ClaudeSessionConfig): Promise<string> {
    const claudeOptions: ClaudeCodeOptions = {
      workingDirectory: config.project_path,
      customSystemPrompt: config.initial_context,
      ...config.options
    };

    const serviceSessionId = await this.claudeService.createSession(claudeOptions);

    if (config.task_id) {
      this.claudeService.setTaskId(serviceSessionId, config.task_id);
    }

    if (config.mcp_session_id) {
      this.claudeService.setMcpSessionId(serviceSessionId, config.mcp_session_id);
    }
    const session = this.sessionStore.createSession(
      'claude',
      serviceSessionId,
      config.project_path,
      config.task_id,
      config.mcp_session_id
    );

    if (config.task_id) {
      await this.taskLogger.logSessionCreated(
        config.task_id,
        session.id,
        'Claude Code',
        config.project_path,
        config.initial_context,
        config.mcp_session_id
      );
    }

    logger.info('Claude session started', {
      sessionId: session.id,
      serviceSessionId,
      projectPath: config.project_path,
      taskId: config.task_id
    });

    return session.id;
  }

  /**
   * Sends a command to Claude
   * 
   * @param session - The agent session
   * @param command - The command to send
   * @param timeout - Optional timeout in milliseconds
   * @returns Result of the command execution
   * 
   * @remarks
   * This method:
   * 1. Logs the command being sent
   * 2. Executes the command via Claude service
   * 3. Stores the output in session store
   * 4. Logs the response or error
   * 
   * @example
   * ```typescript
   * const result = await manager.sendCommand(
   *   session,
   *   'Add input validation to the login form',
   *   30000
   * );
   * 
   * if (result.success) {
   *   console.log('Output:', result.output);
   * }
   * ```
   */
  async sendCommand(
    session: AgentSession,
    command: string,
    timeout?: number
  ): Promise<AgentCommandResult> {
    const startTime = Date.now();

    try {
      if (session.taskId) {
        await this.taskLogger.logCommandSent(session.taskId, command, session.mcpSessionId);
      }

      const output = await this.claudeService.querySync(
        session.serviceSessionId,
        command,
        { maxTurns: DEFAULT_MAX_TURNS, timeout }
      );

      const duration = Date.now() - startTime;
      this.sessionStore.addOutput(session.id, output);

      if (session.taskId) {
        await this.taskLogger.logResponseReceived(
          session.taskId,
          duration,
          output.length,
          output,
          session.mcpSessionId
        );
      }

      return {
        success: true,
        output,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.sessionStore.addError(session.id, errorMessage);

      if (session.taskId) {
        await this.taskLogger.logError(
          session.taskId,
          'Error:',
          error,
          session.mcpSessionId
        );
      }

      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Ends a Claude session
   * 
   * @param session - The agent session to end
   * @throws Error if session termination fails
   * 
   * @remarks
   * This method:
   * 1. Ends the Claude service session
   * 2. Logs successful or failed termination
   * 3. Re-throws any errors after logging
   * 
   * @example
   * ```typescript
   * await manager.endSession(session);
   * ```
   */
  async endSession(session: AgentSession): Promise<void> {
    try {
      await this.claudeService.endSession(session.serviceSessionId);
      
      if (session.taskId) {
        await this.taskLogger.logSessionTermination(
          session.taskId,
          session.id,
          true,
          session.mcpSessionId
        );
      }
    } catch (error) {
      logger.error('Error ending Claude session', { 
        sessionId: session.id,
        error 
      });

      if (session.taskId) {
        await this.taskLogger.logSessionTermination(
          session.taskId,
          session.id,
          false
        );
      }

      throw error;
    }
  }

  /**
   * Sets up event listeners
   * 
   * @param onSessionReady - Callback for when a session becomes ready
   * 
   * @remarks
   * Forwards session:ready events from the Claude service to the
   * provided callback, allowing the agent manager to update session status.
   * 
   * @example
   * ```typescript
   * manager.setupEventListeners((serviceSessionId) => {
   *   console.log(`Session ${serviceSessionId} is ready`);
   * });
   * ```
   */
  setupEventListeners(onSessionReady: (serviceSessionId: string) => void): void {
    this.claudeService.on('session:ready', ({ sessionId }) => {
      onSessionReady(sessionId);
    });
  }
}