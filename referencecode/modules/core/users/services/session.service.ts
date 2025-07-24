/**
 * User session management service
 */

import type { SessionRepository } from '../repositories/session.repository.js';
import type { UserSession, SessionCreateInput } from '../types/index.js';
import { randomBytes } from 'crypto';

export class SessionService {
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly config: any,
    private readonly logger: any,
  ) {}

  /**
   * Create a new session
   */
  async createSession(input: SessionCreateInput): Promise<UserSession> {
    try {
      // Check concurrent session limit
      const userSessions = await this.sessionRepo.findByUserId(input.userId);
      const activeSessions = userSessions.filter((s) => s.isActive);

      const maxConcurrent = this.config.maxConcurrent || 5;
      if (activeSessions.length >= maxConcurrent) {
        // Revoke oldest session
        const oldest = activeSessions.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0];

        if (!oldest) {throw new Error('oldest is required');}
        if (!oldest) {throw new Error('oldest is required');}
        await this.sessionRepo.revoke(oldest.id);
        this.logger?.info('Revoked oldest! session due to limit', { sessionId: oldest.id });
      }

      // Generate session ID and token if not provided
      const id = this.generateSessionId();
      const token = input.token || this.generateToken();

      // Calculate expiry
      const expiresIn = input.expiresIn || this.config.timeout || 86400000; // 24 hours
      const expiresAt = new Date(Date.now() + expiresIn);

      // Create session
      const session: UserSession = {
        id,
        userId: input.userId,
        token,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        isActive: true,
      };

      await this.sessionRepo.create(session);

      this.logger?.info('Session created', { sessionId: id, userId: input.userId });

      return session;
    } catch (error) {
      this.logger?.error('Failed to create session', error);
      throw error;
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId?: string): Promise<UserSession[]> {
    try {
      if (userId) {
        return await this.sessionRepo.findByUserId(userId);
      }

      return await this.sessionRepo.findAll();
    } catch (error) {
      this.logger?.error('Failed to get sessions', error);
      throw error;
    }
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<UserSession | null> {
    try {
      const session = await this.sessionRepo.findByToken(token);

      if (!session) {
        return null;
      }

      // Check if session is active
      if (!session.isActive) {
        return null;
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.sessionRepo.revoke(session.id);
        return null;
      }

      // Update last activity
      await this.sessionRepo.updateActivity(session.id);

      return session;
    } catch (error) {
      this.logger?.error('Failed to validate session', error);
      throw error;
    }
  }

  /**
   * Revoke user sessions
   */
  async revokeUserSessions(userId: string, sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        // Revoke specific session
        const session = await this.sessionRepo.findById(sessionId);
        if (session && session.userId === userId) {
          await this.sessionRepo.revoke(sessionId);
          this.logger?.info('Session revoked', { sessionId, userId });
        }
      } else {
        // Revoke all user sessions
        const sessions = await this.sessionRepo.findByUserId(userId);

        for (const session of sessions) {
          if (session.isActive) {
            await this.sessionRepo.revoke(session.id);
          }
        }

        this.logger?.info('All sessions revoked', { userId, count: sessions.length });
      }
    } catch (error) {
      this.logger?.error('Failed to revoke sessions', error);
      throw error;
    }
  }

  /**
   * Start session cleanup interval
   */
  async startCleanup(intervalMs: number): Promise<void> {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup immediately
    await this.cleanupExpiredSessions();

    // Set interval
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, intervalMs);

    this.logger?.info('Session cleanup started', { interval: intervalMs });
  }

  /**
   * Stop session cleanup
   */
  async stopCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger?.info('Session cleanup stopped');
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const count = await this.sessionRepo.deleteExpired();

      if (count > 0) {
        this.logger?.info('Cleaned up expired sessions', { count });
      }
    } catch (error) {
      this.logger?.error('Failed to cleanup sessions', error);
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate secure token
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
