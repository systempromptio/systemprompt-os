/**
 * @fileoverview Session storage for Agent Manager
 * @module services/agent-manager/session-store
 * 
 * @remarks
 * This module provides in-memory storage and management for agent sessions.
 * It handles session lifecycle, state tracking, and metrics collection for
 * all active agent sessions in the system.
 * 
 * @example
 * ```typescript
 * import { SessionStore } from './session-store';
 * 
 * const store = new SessionStore();
 * 
 * const session = store.createSession(
 *   'claude',
 *   'service-123',
 *   '/path/to/project',
 *   'task-456'
 * );
 * 
 * store.updateStatus(session.id, 'busy');
 * store.addOutput(session.id, 'Processing...');
 * ```
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  AgentSession, 
  AgentType, 
  AgentSessionStatus,
  SessionMetrics 
} from './types.js';
import { SESSION_ID_PREFIXES } from './constants.js';
import { SessionNotFoundError } from './errors.js';

/**
 * Manages agent session state and metrics
 * 
 * @class SessionStore
 * 
 * @remarks
 * This class provides:
 * - Session creation with unique IDs
 * - Session state management (status, activity tracking)
 * - Output and error buffering
 * - Session queries by ID, service ID, or type
 * - Metrics collection for monitoring
 */
export class SessionStore {
  private readonly sessions = new Map<string, AgentSession>();

  /**
   * Creates a new session
   * 
   * @param type - The agent type (e.g., 'claude')
   * @param serviceSessionId - The underlying service session ID
   * @param projectPath - Path to the project directory
   * @param taskId - Optional task ID to associate
   * @param mcpSessionId - Optional MCP session ID
   * @returns The created agent session
   * 
   * @example
   * ```typescript
   * const session = store.createSession(
   *   'claude',
   *   'claude-service-123',
   *   '/home/user/project',
   *   'task-456',
   *   'mcp-789'
   * );
   * ```
   */
  createSession(
    type: AgentType,
    serviceSessionId: string,
    projectPath: string,
    taskId?: string,
    mcpSessionId?: string
  ): AgentSession {
    const sessionId = `${SESSION_ID_PREFIXES[type.toUpperCase() as keyof typeof SESSION_ID_PREFIXES]}${uuidv4()}`;
    
    const session: AgentSession = {
      id: sessionId,
      type,
      serviceSessionId,
      status: 'active',
      projectPath,
      taskId,
      mcpSessionId,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      output_buffer: [],
      error_buffer: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Gets a session by ID
   * 
   * @param sessionId - The session ID to retrieve
   * @returns The agent session
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  getSession(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }

  /**
   * Finds a session by ID
   * 
   * @param sessionId - The session ID to find
   * @returns The session if found, null otherwise
   */
  findSession(sessionId: string): AgentSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Finds a session by service ID
   * 
   * @param serviceSessionId - The service session ID to search for
   * @returns The session if found, undefined otherwise
   */
  findSessionByServiceId(serviceSessionId: string): AgentSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.serviceSessionId === serviceSessionId) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Updates session status
   * 
   * @param sessionId - The session ID to update
   * @param status - The new status
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  updateStatus(sessionId: string, status: AgentSessionStatus): void {
    const session = this.getSession(sessionId);
    session.status = status;
    session.last_activity = new Date().toISOString();
  }

  /**
   * Updates session activity
   * 
   * @param sessionId - The session ID to update
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  updateActivity(sessionId: string): void {
    const session = this.getSession(sessionId);
    session.last_activity = new Date().toISOString();
  }

  /**
   * Adds output to session buffer
   * 
   * @param sessionId - The session ID
   * @param output - The output to add
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  addOutput(sessionId: string, output: string): void {
    const session = this.getSession(sessionId);
    session.output_buffer.push(output);
    session.last_activity = new Date().toISOString();
  }

  /**
   * Adds error to session buffer
   * 
   * @param sessionId - The session ID
   * @param error - The error message to add
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  addError(sessionId: string, error: string): void {
    const session = this.getSession(sessionId);
    session.error_buffer.push(error);
    session.last_activity = new Date().toISOString();
  }

  /**
   * Deletes a session
   * 
   * @param sessionId - The session ID to delete
   * @returns True if session was deleted, false if not found
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Gets all sessions
   * 
   * @returns Array of all agent sessions
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets sessions by type
   * 
   * @param type - The agent type to filter by
   * @returns Array of sessions for the specified type
   */
  getSessionsByType(type: AgentType): AgentSession[] {
    return Array.from(this.sessions.values()).filter(s => s.type === type);
  }

  /**
   * Gets session metrics
   * 
   * @returns Current session metrics
   * 
   * @example
   * ```typescript
   * const metrics = store.getMetrics();
   * console.log(`Total sessions: ${metrics.totalSessions}`);
   * console.log(`Active: ${metrics.activeSessions}`);
   * console.log(`By type:`, metrics.sessionsByType);
   * ```
   */
  getMetrics(): SessionMetrics {
    const sessions = this.getAllSessions();
    
    const sessionsByType = sessions.reduce((acc, session) => {
      acc[session.type] = (acc[session.type] || 0) + 1;
      return acc;
    }, {} as Record<AgentType, number>);

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      busySessions: sessions.filter(s => s.status === 'busy').length,
      errorSessions: sessions.filter(s => s.status === 'error').length,
      sessionsByType
    };
  }
}