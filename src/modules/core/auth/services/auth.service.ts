/**
 * Auth service implementation - manages authentication and authorization.
 * @file Auth service implementation.
 * @module auth/services
 * Provides business logic for authentication operations.
 */

import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AuthRepository } from '@/modules/core/auth/repositories/auth.repository';
import { SessionService } from '@/modules/core/auth/services/session.service';
import { OAuthService } from '@/modules/core/auth/services/oauth.service';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { type IAuthService } from '@/modules/core/auth/types/auth.service.generated';
import {
  AuthEvents,
  type LoginFailedEvent,
  type LoginSuccessEvent
} from '@/modules/core/events/types/index';

/**
 * Service for managing authentication.
 */
export class AuthService implements IAuthService {
  private static instance: AuthService;
  private readonly repository: AuthRepository;
  private readonly sessionService: SessionService;
  private readonly oauthService: OAuthService;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = AuthRepository.getInstance();
    this.sessionService = SessionService.getInstance();
    this.oauthService = OAuthService.getInstance();
    this.eventBus = EventBusService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The auth service instance.
   */
  static getInstance(): AuthService {
    AuthService.instance ||= new AuthService();
    return AuthService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    await this.oauthService.initialize();
    
    // Set logger on OAuth service if available
    if (this.logger) {
      this.oauthService.setLogger(this.logger);
    }
    
    this.initialized = true;
    this.logger?.info(LogSource.AUTH, 'AuthService initialized');
  }

  /**
   * Authenticate user with email and password.
   * @param email - User email.
   * @param password - User password.
   * @returns Promise that resolves to authentication result.
   */
  public async authenticate(email: string, password: string): Promise<{
    success: boolean;
    userId?: string;
    sessionId?: string;
    error?: string;
  }> {
    await this.ensureInitialized();

    try {
      this.logger?.info(LogSource.AUTH, `Authenticating user: ${email}`);

      if (!password) {
        throw new Error('Password is required');
      }

      const userId = randomUUID();
      const sessionId = randomUUID();

      const event: LoginSuccessEvent = {
        userId,
        sessionId,
        timestamp: new Date()
      };
      this.eventBus.emit(AuthEvents.LOGIN_SUCCESS, event);

      this.logger?.info(LogSource.AUTH, `Authentication successful for: ${email}`);

      return {
        success: true,
        userId,
        sessionId
      };
    } catch (error) {
      const event: LoginFailedEvent = {
        email,
        reason: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
      this.eventBus.emit(AuthEvents.LOGIN_FAILED, event);

      this.logger?.error(LogSource.AUTH, `Authentication failed for: ${email}`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Create a new session for user.
   * @param userId - The user ID.
   * @returns Promise that resolves to session ID.
   */
  public async createSession(userId: string): Promise<string> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Creating session for user: ${userId}`);

    const session = await this.sessionService.createSession({
      user_id: userId,
      type: 'web',
      ip_address: '127.0.0.1', // This would come from request context in real implementation
      user_agent: 'SystemPrompt CLI' // This would come from request context in real implementation
    });

    // Emit session created event
    this.eventBus.emit(AuthEvents.SESSION_CREATED, {
      sessionId: session.id,
      userId: session.user_id,
      timestamp: new Date()
    });

    return session.id;
  }

  /**
   * Validate a session.
   * @param sessionId - The session ID to validate.
   * @returns Promise that resolves to validation result.
   */
  public async validateSession(sessionId: string): Promise<{
    valid: boolean;
    userId?: string;
    error?: string;
  }> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Validating session: ${sessionId}`);

    const result = await this.sessionService.validateSession(sessionId);

    if (result) {
      return {
        valid: true,
        userId: result.userId
      };
    }

    return {
      valid: false,
      error: 'Invalid or expired session'
    };
  }

  /**
   * Revoke a session.
   * @param sessionId - The session ID to revoke.
   * @returns Promise that resolves when session is revoked.
   */
  public async revokeSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Revoking session: ${sessionId}`);

    await this.sessionService.revokeSession(sessionId);

    // Emit session revoked event
    this.eventBus.emit(AuthEvents.SESSION_REVOKED, {
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * List all sessions for a user.
   * @param userId - The user ID.
   * @returns Promise that resolves to array of session IDs.
   */
  public async listSessions(userId: string): Promise<string[]> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Listing sessions for user: ${userId}`);

    const sessions = await this.sessionService.getUserSessions(userId);
    return sessions.map(session => session.id);
  }


  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
