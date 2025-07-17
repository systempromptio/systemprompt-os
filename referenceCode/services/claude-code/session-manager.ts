/**
 * @fileoverview Session management for Claude Code service
 * @module services/claude-code/session-manager
 * 
 * @remarks
 * This module provides session lifecycle management for Claude Code instances.
 * It handles session creation, status tracking, activity monitoring, and cleanup.
 * Each session represents an isolated Claude interaction context with its own
 * working directory, options, and output buffers.
 * 
 * @example
 * ```typescript
 * import { SessionManager } from './session-manager';
 * 
 * const manager = new SessionManager();
 * 
 * // Create a new session
 * const session = manager.createSession({
 *   workingDirectory: '/project',
 *   maxTurns: 20
 * });
 * 
 * // Update session status
 * manager.updateStatus(session.id, 'busy');
 * 
 * // Link to task
 * manager.setTaskId(session.id, 'task-123');
 * 
 * // Clean up old sessions
 * const cleaned = manager.cleanupOldSessions();
 * ```
 */

import { v4 as uuidv4 } from 'uuid';
import type { ClaudeCodeSession, ClaudeCodeOptions, SessionStatus } from './types.js';
import { SessionNotFoundError } from './errors.js';
import { SESSION_ID_PREFIX } from './constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Manages Claude Code session lifecycle and state
 * 
 * @class SessionManager
 * 
 * @remarks
 * This class provides centralized management for Claude Code sessions,
 * including creation, tracking, and cleanup. It maintains an in-memory
 * store of active sessions and provides methods for session manipulation.
 */
export class SessionManager {
  private readonly sessions = new Map<string, ClaudeCodeSession>();

  /**
   * Creates a new Claude Code session
   * 
   * @param options - Session configuration options
   * @returns The newly created session
   * 
   * @example
   * ```typescript
   * const session = manager.createSession({
   *   workingDirectory: '/home/user/project',
   *   maxTurns: 30,
   *   model: 'claude-3-opus-20240229'
   * });
   * ```
   */
  createSession(options: ClaudeCodeOptions = {}): ClaudeCodeSession {
    const sessionId = `${SESSION_ID_PREFIX}${uuidv4()}`;
    
    const session: ClaudeCodeSession = {
      id: sessionId,
      status: 'ready',
      workingDirectory: options.workingDirectory || process.cwd(),
      options,
      outputBuffer: [],
      errorBuffer: [],
      streamBuffer: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    logger.info('Creating Claude session', {
      sessionId,
      workingDirectory: session.workingDirectory,
      options
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Gets a session by ID, throwing if not found
   * 
   * @param sessionId - The session ID to retrieve
   * @returns The session
   * @throws {SessionNotFoundError} If session does not exist
   */
  getSession(sessionId: string): ClaudeCodeSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }

  /**
   * Finds a session by ID without throwing
   * 
   * @param sessionId - The session ID to find
   * @returns The session if found, undefined otherwise
   */
  findSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Updates the status of a session
   * 
   * @param sessionId - The session ID to update
   * @param status - The new status
   * @throws {SessionNotFoundError} If session does not exist
   */
  updateStatus(sessionId: string, status: SessionStatus): void {
    const session = this.getSession(sessionId);
    session.status = status;
    session.lastActivity = new Date();
  }

  /**
   * Updates the last activity timestamp for a session
   * 
   * @param sessionId - The session ID to update
   * @throws {SessionNotFoundError} If session does not exist
   */
  updateActivity(sessionId: string): void {
    const session = this.getSession(sessionId);
    session.lastActivity = new Date();
  }

  /**
   * Associates a task ID with a session
   * 
   * @param sessionId - The session ID
   * @param taskId - The task ID to associate
   * @throws {SessionNotFoundError} If session does not exist
   */
  setTaskId(sessionId: string, taskId: string): void {
    const session = this.getSession(sessionId);
    session.taskId = taskId;
    logger.info('Linked session to task', { sessionId, taskId });
  }

  /**
   * Associates an MCP session ID with a Claude session
   * 
   * @param sessionId - The Claude session ID
   * @param mcpSessionId - The MCP session ID to associate
   * @throws {SessionNotFoundError} If session does not exist
   */
  setMcpSessionId(sessionId: string, mcpSessionId: string): void {
    const session = this.getSession(sessionId);
    session.mcpSessionId = mcpSessionId;
    logger.info('Linked session to MCP session', { sessionId, mcpSessionId });
  }

  /**
   * Terminates a session and cleans up resources
   * 
   * @param sessionId - The session ID to terminate
   * 
   * @remarks
   * This method:
   * - Aborts any active operations
   * - Updates session status to 'terminated'
   * - Removes the session from the manager
   * - Is idempotent (safe to call multiple times)
   */
  endSession(sessionId: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;

    if (session.abortController) {
      session.abortController.abort();
    }

    session.status = 'terminated';
    this.sessions.delete(sessionId);
    logger.info('Session terminated', { sessionId });
  }

  /**
   * Gets all active sessions
   * 
   * @returns Array of all sessions
   */
  getAllSessions(): ClaudeCodeSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets aggregated metrics for all sessions
   * 
   * @returns Session metrics including counts and averages
   * 
   * @example
   * ```typescript
   * const metrics = manager.getMetrics();
   * console.log(`Active sessions: ${metrics.activeSessions}`);
   * console.log(`Error rate: ${metrics.errorSessions / metrics.totalSessions}`);
   * ```
   */
  getMetrics() {
    const sessions = this.getAllSessions();
    const activeSessions = sessions.filter(s => s.status === 'ready' || s.status === 'busy');
    const errorSessions = sessions.filter(s => s.status === 'error');

    const durations = sessions
      .filter(s => s.status === 'terminated')
      .map(s => s.lastActivity.getTime() - s.createdAt.getTime());

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      errorSessions: errorSessions.length,
      averageSessionDuration: durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0
    };
  }

  /**
   * Removes sessions older than the specified age
   * 
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   * @returns Number of sessions cleaned up
   * 
   * @remarks
   * Sessions are considered old based on their last activity timestamp.
   * This method should be called periodically to prevent memory leaks.
   * 
   * @example
   * ```typescript
   * // Clean up sessions older than 30 minutes
   * const cleaned = manager.cleanupOldSessions(30 * 60 * 1000);
   * ```
   */
  cleanupOldSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > maxAgeMs) {
        this.endSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old sessions', { count: cleaned });
    }

    return cleaned;
  }
}